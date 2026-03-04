import os
import subprocess
import tempfile
import httpx

from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

app = FastAPI(title="GifWave Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

GIPHY_API_KEY = os.getenv("GIPHY_API_KEY", "")
GIPHY_BASE = "https://api.giphy.com/v1/gifs"


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/giphy/trending")
async def giphy_trending(limit: int = Query(24, le=50)):
    if not GIPHY_API_KEY:
        return {"gifs": []}
    async with httpx.AsyncClient() as client:
        res = await client.get(f"{GIPHY_BASE}/trending", params={
            "api_key": GIPHY_API_KEY,
            "limit": limit,
            "rating": "g"
        })
    data = res.json()
    gifs = [
        {
            "id": g["id"],
            "url": g["images"]["original"]["url"],
            "preview": g["images"]["fixed_height"]["url"],
            "title": g["title"]
        }
        for g in data.get("data", [])
    ]
    return {"gifs": gifs}


@app.get("/giphy/search")
async def giphy_search(q: str = Query(...), limit: int = Query(20, le=50)):
    if not GIPHY_API_KEY:
        return {"gifs": []}
    async with httpx.AsyncClient() as client:
        res = await client.get(f"{GIPHY_BASE}/search", params={
            "api_key": GIPHY_API_KEY,
            "q": q,
            "limit": limit,
            "rating": "g"
        })
    data = res.json()
    gifs = [
        {
            "id": g["id"],
            "url": g["images"]["original"]["url"],
            "preview": g["images"]["fixed_height"]["url"],
            "title": g["title"]
        }
        for g in data.get("data", [])
    ]
    return {"gifs": gifs}


@app.post("/convert")
async def convert_video_to_gif(file: UploadFile = File(...)):
    """Video (mp4/webm/mov) → GIF dönüştürür (ffmpeg kullanır)"""
    allowed_types = ["video/mp4", "video/webm", "video/quicktime", "video/avi"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Desteklenmeyen video formatı")

    with tempfile.TemporaryDirectory() as tmpdir:
        input_path = os.path.join(tmpdir, f"input_{file.filename}")
        output_path = os.path.join(tmpdir, "output.gif")

        # Dosyayı kaydet
        content = await file.read()
        if len(content) > 50 * 1024 * 1024:  # 50MB
            raise HTTPException(status_code=400, detail="Dosya çok büyük (maks 50MB)")

        with open(input_path, "wb") as f:
            f.write(content)

        # ffmpeg ile GIF'e dönüştür (kalite dengeli)
        palette_path = os.path.join(tmpdir, "palette.png")

        try:
            # 1. Palet oluştur (daha iyi kalite)
            subprocess.run([
                "ffmpeg", "-y", "-i", input_path,
                "-vf", "fps=12,scale=480:-1:flags=lanczos,palettegen",
                palette_path
            ], check=True, capture_output=True, timeout=120)

            # 2. GIF oluştur
            subprocess.run([
                "ffmpeg", "-y", "-i", input_path, "-i", palette_path,
                "-lavfi", "fps=12,scale=480:-1:flags=lanczos[x];[x][1:v]paletteuse",
                output_path
            ], check=True, capture_output=True, timeout=120)
        except subprocess.CalledProcessError as e:
            raise HTTPException(status_code=500, detail=f"Dönüştürme hatası: {e.stderr.decode()[:200]}")
        except subprocess.TimeoutExpired:
            raise HTTPException(status_code=500, detail="Dönüştürme zaman aşımı")
        except FileNotFoundError:
            raise HTTPException(status_code=500, detail="ffmpeg kurulu değil")

        if not os.path.exists(output_path):
            raise HTTPException(status_code=500, detail="GIF oluşturulamadı")

        # Dosyayı oku ve döndür
        with open(output_path, "rb") as f:
            gif_bytes = f.read()

    from fastapi.responses import Response
    return Response(content=gif_bytes, media_type="image/gif",
                    headers={"Content-Disposition": "attachment; filename=output.gif"})


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
