import os
import subprocess
import tempfile
import httpx

from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

app = FastAPI(title="GifWave Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Tenor v1 — ücretsiz demo key (rate limit var ama çalışır)
TENOR_KEY = os.getenv("TENOR_KEY", "LIVDSRZULELA")
TENOR_BASE = "https://api.tenor.com/v1"


def parse_tenor(results):
    gifs = []
    for r in results:
        media = r.get("media", [{}])[0]
        gif_url = media.get("gif", {}).get("url", "")
        preview_url = media.get("tinygif", {}).get("url", gif_url)
        if gif_url:
            gifs.append({
                "id": r["id"],
                "url": gif_url,
                "preview": preview_url,
                "title": r.get("title") or r.get("content_description") or ""
            })
    return gifs


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/giphy/trending")
async def trending(limit: int = Query(24, le=50)):
    async with httpx.AsyncClient(timeout=10) as client:
        res = await client.get(f"{TENOR_BASE}/trending", params={
            "key": TENOR_KEY,
            "limit": limit,
            "media_filter": "minimal",
            "locale": "tr_TR"
        })
    data = res.json()
    return {"gifs": parse_tenor(data.get("results", []))}


@app.get("/giphy/search")
async def search(q: str = Query(...), limit: int = Query(20, le=50)):
    async with httpx.AsyncClient(timeout=10) as client:
        res = await client.get(f"{TENOR_BASE}/search", params={
            "key": TENOR_KEY,
            "q": q,
            "limit": limit,
            "media_filter": "minimal",
            "locale": "tr_TR"
        })
    data = res.json()
    return {"gifs": parse_tenor(data.get("results", []))}


@app.post("/convert")
async def convert_video_to_gif(file: UploadFile = File(...)):
    allowed_types = ["video/mp4", "video/webm", "video/quicktime", "video/avi"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Desteklenmeyen video formatı")

    with tempfile.TemporaryDirectory() as tmpdir:
        input_path = os.path.join(tmpdir, f"input_{file.filename or 'video'}")
        output_path = os.path.join(tmpdir, "output.gif")
        palette_path = os.path.join(tmpdir, "palette.png")

        content = await file.read()
        if len(content) > 50 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Dosya çok büyük (maks 50MB)")

        with open(input_path, "wb") as f:
            f.write(content)

        try:
            subprocess.run([
                "ffmpeg", "-y", "-i", input_path,
                "-vf", "fps=12,scale=480:-1:flags=lanczos,palettegen",
                palette_path
            ], check=True, capture_output=True, timeout=120)

            subprocess.run([
                "ffmpeg", "-y", "-i", input_path, "-i", palette_path,
                "-lavfi", "fps=12,scale=480:-1:flags=lanczos[x];[x][1:v]paletteuse",
                output_path
            ], check=True, capture_output=True, timeout=120)
        except subprocess.CalledProcessError as e:
            raise HTTPException(status_code=500, detail=f"Dönüştürme hatası: {e.stderr.decode()[:200]}")
        except subprocess.TimeoutExpired:
            raise HTTPException(status_code=500, detail="Zaman aşımı")
        except FileNotFoundError:
            raise HTTPException(status_code=500, detail="ffmpeg kurulu değil")

        if not os.path.exists(output_path):
            raise HTTPException(status_code=500, detail="GIF oluşturulamadı")

        with open(output_path, "rb") as f:
            gif_bytes = f.read()

    return Response(content=gif_bytes, media_type="image/gif",
                    headers={"Content-Disposition": "attachment; filename=output.gif"})


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
