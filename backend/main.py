import os
import subprocess
import tempfile
import time
import asyncio
import httpx

from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse

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
async def trending(limit: int = Query(24, le=50), pos: str = Query("")):
    params = {"key": TENOR_KEY, "limit": limit, "media_filter": "minimal", "locale": "tr_TR"}
    if pos:
        params["pos"] = pos
    async with httpx.AsyncClient(timeout=10) as client:
        res = await client.get(f"{TENOR_BASE}/trending", params=params)
    data = res.json()
    return {"gifs": parse_tenor(data.get("results", [])), "next": data.get("next", "")}


@app.get("/giphy/search")
async def search(q: str = Query(...), limit: int = Query(20, le=50), pos: str = Query("")):
    params = {"key": TENOR_KEY, "q": q, "limit": limit, "media_filter": "minimal", "locale": "tr_TR"}
    if pos:
        params["pos"] = pos
    async with httpx.AsyncClient(timeout=10) as client:
        res = await client.get(f"{TENOR_BASE}/search", params=params)
    data = res.json()
    return {"gifs": parse_tenor(data.get("results", [])), "next": data.get("next", "")}


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


SUPABASE_URL = os.getenv("SUPABASE_URL", "https://nwdwfwokdpjdkpsztuuo.supabase.co")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

# Piped API — YouTube'u yt-dlp olmadan audio stream'e dönüştürür
PIPED_INSTANCES = [
    "https://pipedapi.kavin.rocks",
    "https://piped-api.garudalinux.org",
    "https://api.piped.yt",
    "https://pipedapi.tokhmi.xyz",
]


def _extract_youtube_id(url: str):
    from urllib.parse import urlparse, parse_qs
    try:
        u = urlparse(url)
        if "youtube.com" in u.netloc or "music.youtube.com" in u.netloc:
            return parse_qs(u.query).get("v", [None])[0]
        if "youtu.be" in u.netloc:
            return u.path.lstrip("/").split("?")[0]
    except Exception:
        pass
    return None


async def _get_piped_audio(video_id: str):
    """Piped API ile YouTube ses stream URL'si al — birden fazla instance dene."""
    for instance in PIPED_INSTANCES:
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(f"{instance}/streams/{video_id}")
                if resp.status_code != 200:
                    continue
                data = resp.json()
                title = data.get("title", "Müzik")
                streams = data.get("audioStreams", [])
                if not streams:
                    continue
                # m4a/mp4 öncelikli, yoksa webm
                m4a = [s for s in streams if "mp4" in s.get("mimeType", "")]
                best = sorted(m4a or streams, key=lambda x: x.get("bitrate", 0), reverse=True)[0]
                return best["url"], best.get("mimeType", "audio/mp4"), title
        except Exception:
            continue
    return None, None, None


@app.get("/music/proxy")
async def proxy_music(url: str = Query(...)):
    """YouTube sesini CORS sorunsuz proxy üzerinden aktar."""
    import yt_dlp

    def extract():
        ydl_opts = {
            "format": "bestaudio[ext=m4a]/bestaudio/best",
            "quiet": True,
            "no_warnings": True,
            "extractor_args": {"youtube": {"player_client": ["android"]}},
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            formats = info.get("formats", [info])
            audio = [f for f in formats if f.get("vcodec") == "none" and f.get("acodec") != "none"]
            if audio:
                best = sorted(audio, key=lambda f: f.get("abr") or 0, reverse=True)[0]
                return best["url"], best.get("http_headers", {}), best.get("ext", "m4a")
            return info.get("url", ""), {}, "m4a"

    try:
        stream_url, yt_headers, ext = await asyncio.get_event_loop().run_in_executor(None, extract)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)[:120])

    if not stream_url:
        raise HTTPException(status_code=400, detail="Ses URL'si alınamadı")

    req_headers = {}
    if yt_headers.get("User-Agent"):
        req_headers["User-Agent"] = yt_headers["User-Agent"]

    mime_map = {"m4a": "audio/mp4", "webm": "audio/webm", "mp3": "audio/mpeg", "ogg": "audio/ogg"}
    mime = mime_map.get(ext, "audio/mp4")

    async def stream():
        async with httpx.AsyncClient(timeout=300) as client:
            async with client.stream("GET", stream_url, headers=req_headers, follow_redirects=True) as resp:
                async for chunk in resp.aiter_bytes(16384):
                    yield chunk

    return StreamingResponse(stream(), media_type=mime, headers={"Cache-Control": "no-store"})


@app.post("/music/extract")
async def extract_music(url: str = Query(...)):
    """Piped API ile YouTube sesini Supabase storage'a yükle — yt-dlp bağımlılığı yok."""
    if not SUPABASE_SERVICE_KEY:
        raise HTTPException(status_code=500, detail="SUPABASE_SERVICE_ROLE_KEY eksik")

    video_id = _extract_youtube_id(url)
    if not video_id:
        raise HTTPException(status_code=400, detail="Geçersiz YouTube URL'si")

    stream_url, mime_type, title = await _get_piped_audio(video_id)
    if not stream_url:
        raise HTTPException(status_code=400, detail="Ses stream'i alınamadı (Piped API)")

    try:
        async with httpx.AsyncClient(timeout=120, follow_redirects=True) as client:
            audio_resp = await client.get(stream_url)
            audio_resp.raise_for_status()
            audio_data = audio_resp.content
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ses indirme hatası: {str(e)[:80]}")

    ext = "m4a" if "mp4" in (mime_type or "") else "webm"
    mime = mime_type or "audio/mp4"
    filename = f"yt_{video_id}_{int(time.time())}.{ext}"

    async with httpx.AsyncClient(timeout=60) as client:
        res = await client.post(
            f"{SUPABASE_URL}/storage/v1/object/music/{filename}",
            headers={"Authorization": f"Bearer {SUPABASE_SERVICE_KEY}", "Content-Type": mime},
            content=audio_data,
        )

    if res.status_code not in (200, 201):
        raise HTTPException(status_code=500, detail=f"Storage hatası: {res.text[:100]}")

    public_url = f"{SUPABASE_URL}/storage/v1/object/public/music/{filename}"
    return {"url": public_url, "title": title}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
