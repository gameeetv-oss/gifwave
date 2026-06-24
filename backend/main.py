import os
import subprocess
import tempfile
import time
import asyncio
import httpx
import string
import secrets
from datetime import datetime, timedelta

from fastapi import FastAPI, UploadFile, File, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel

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


@app.post("/extract-audio")
async def extract_audio_from_video(file: UploadFile = File(...)):
    """Video dosyasından mp3 ses çıkarır."""
    allowed_types = ["video/mp4", "video/webm", "video/quicktime", "video/avi", "video/x-m4v"]
    ctype = (file.content_type or "").lower()
    if ctype and not any(ctype.startswith(a.split(";")[0]) for a in allowed_types):
        raise HTTPException(status_code=400, detail="Desteklenmeyen video formatı")

    with tempfile.TemporaryDirectory() as tmpdir:
        input_path = os.path.join(tmpdir, f"input_{file.filename or 'video'}")
        output_path = os.path.join(tmpdir, "output.mp3")

        content = await file.read()
        if len(content) > 50 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Dosya çok büyük (maks 50MB)")
        with open(input_path, "wb") as f:
            f.write(content)

        try:
            subprocess.run([
                "ffmpeg", "-y", "-i", input_path,
                "-vn", "-acodec", "libmp3lame", "-q:a", "4",
                output_path
            ], check=True, capture_output=True, timeout=90)
        except subprocess.CalledProcessError as e:
            raise HTTPException(status_code=500, detail=f"Ses çıkarma hatası: {e.stderr.decode()[:200]}")
        except subprocess.TimeoutExpired:
            raise HTTPException(status_code=500, detail="Zaman aşımı")
        except FileNotFoundError:
            raise HTTPException(status_code=500, detail="ffmpeg kurulu değil")

        if not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
            raise HTTPException(status_code=500, detail="Ses çıkarılamadı (videoda ses olmayabilir)")

        with open(output_path, "rb") as f:
            audio_bytes = f.read()

    return Response(content=audio_bytes, media_type="audio/mpeg",
                    headers={"Content-Disposition": "attachment; filename=extracted.mp3"})


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
                "ffmpeg", "-y", "-t", "8", "-i", input_path,
                "-vf", "fps=10,scale=320:-1:flags=lanczos,palettegen=max_colors=64",
                palette_path
            ], check=True, capture_output=True, timeout=60)

            subprocess.run([
                "ffmpeg", "-y", "-t", "8", "-i", input_path, "-i", palette_path,
                "-lavfi", "fps=10,scale=320:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer",
                output_path
            ], check=True, capture_output=True, timeout=60)
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


# ── Premium sistemi ───────────────────────────────────────────────────────

def _sb_headers():
    return {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
    }


async def _sb_select(table: str, eq: dict = None):
    params = {"select": "*"}
    if eq:
        params.update({k: f"eq.{v}" for k, v in eq.items()})
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.get(f"{SUPABASE_URL}/rest/v1/{table}", params=params, headers=_sb_headers())
    return r.json() if r.status_code == 200 else []


async def _sb_update(table: str, eq: dict, data: dict):
    params = {k: f"eq.{v}" for k, v in eq.items()}
    async with httpx.AsyncClient(timeout=10) as c:
        return await c.patch(f"{SUPABASE_URL}/rest/v1/{table}", params=params, json=data,
                             headers={**_sb_headers(), "Prefer": "return=representation"})


async def _sb_insert(table: str, data):
    async with httpx.AsyncClient(timeout=10) as c:
        return await c.post(f"{SUPABASE_URL}/rest/v1/{table}", json=data,
                            headers={**_sb_headers(), "Prefer": "return=representation"})


async def _activate_premium(user_id: str, days: int = 30):
    until = (datetime.utcnow() + timedelta(days=days)).isoformat() + "Z"
    await _sb_update("profiles", {"id": user_id}, {"is_premium": True, "premium_until": until})


class ActivateCodeRequest(BaseModel):
    code: str
    user_id: str


class VerifyPaymentRequest(BaseModel):
    email: str
    user_id: str


class GenerateCodesRequest(BaseModel):
    count: int = 1
    admin_key: str


ADMIN_KEY = os.getenv("ADMIN_KEY", "gifwave-admin-2024")


@app.post("/premium/activate")
async def premium_activate(req: ActivateCodeRequest):
    if not SUPABASE_SERVICE_KEY:
        raise HTTPException(500, "SUPABASE_SERVICE_ROLE_KEY eksik")
    rows = await _sb_select("premium_codes", {"code": req.code.upper().strip()})
    if not rows:
        raise HTTPException(400, "Geçersiz kod")
    row = rows[0]
    if row.get("used"):
        raise HTTPException(400, "Bu kod zaten kullanıldı")
    await _sb_update("premium_codes", {"id": row["id"]}, {"used": True, "used_by": req.user_id})
    await _activate_premium(req.user_id)
    return {"status": "ok"}


@app.post("/premium/verify-payment")
async def premium_verify_payment(req: VerifyPaymentRequest):
    if not SUPABASE_SERVICE_KEY:
        raise HTTPException(500, "SUPABASE_SERVICE_ROLE_KEY eksik")
    rows = await _sb_select("premium_payments", {"email": req.email.lower().strip()})
    if not rows:
        raise HTTPException(400, "Bu e-posta ile ödeme bulunamadı. Shopier/Whop'ta kullandığın e-postayı gir.")
    row = rows[0]
    if row.get("activated_for"):
        raise HTTPException(400, "Bu ödeme zaten kullanıldı")
    await _sb_update("premium_payments", {"id": row["id"]}, {"activated_for": req.user_id})
    await _activate_premium(req.user_id)
    return {"status": "ok"}


@app.post("/webhooks/whop")
async def whop_webhook(request: Request):
    try:
        data = await request.json()
    except Exception:
        raise HTTPException(400, "Geçersiz JSON")
    event = data.get("event", "")
    if event not in ("payment.completed", "membership.went_valid"):
        return {"status": "ignored"}
    d = data.get("data", {})
    email = d.get("user", {}).get("email") or d.get("email")
    if not email:
        return {"status": "no_email"}
    await _sb_insert("premium_payments", {
        "email": email.lower().strip(), "provider": "whop", "payload": str(data)[:500]
    })
    return {"status": "ok"}


@app.post("/webhooks/shopier")
async def shopier_webhook(request: Request):
    try:
        body = await request.body()
        from urllib.parse import parse_qs
        flat = {k: v[0] for k, v in parse_qs(body.decode("utf-8", errors="ignore")).items()}
    except Exception:
        raise HTTPException(400, "Geçersiz veri")
    email = flat.get("buyer_email", "").strip()
    status = flat.get("payment_status", "")
    if status != "1" or not email:
        return {"status": "ignored"}
    await _sb_insert("premium_payments", {
        "email": email.lower(), "provider": "shopier", "payload": str(flat)[:500]
    })
    return {"status": "ok"}


@app.post("/webhooks/revenuecat")
async def revenuecat_webhook(request: Request):
    """RevenueCat → Google Play satın alma bildirimi."""
    try:
        data = await request.json()
    except Exception:
        raise HTTPException(400, "Geçersiz JSON")

    event = data.get("event", {})
    event_type = event.get("type", "")

    # Aktif abonelik olayları
    ACTIVE_EVENTS = {
        "INITIAL_PURCHASE", "RENEWAL", "PRODUCT_CHANGE",
        "UNCANCELLATION", "SUBSCRIBER_ALIAS",
    }
    if event_type not in ACTIVE_EVENTS:
        return {"status": "ignored", "type": event_type}

    app_user_id = event.get("app_user_id", "")
    # RevenueCat app_user_id olarak Supabase user_id gönderiyoruz
    if not app_user_id:
        return {"status": "no_user_id"}

    # Abonelik bitiş tarihini hesapla (genellikle 30 gün)
    expiration_at_ms = event.get("expiration_at_ms")
    if expiration_at_ms:
        from datetime import timezone
        until = datetime.fromtimestamp(expiration_at_ms / 1000, tz=timezone.utc).isoformat()
        await _sb_update("profiles", {"id": app_user_id},
                         {"is_premium": True, "premium_until": until})
    else:
        await _activate_premium(app_user_id, days=32)

    return {"status": "ok", "user": app_user_id}


@app.post("/admin/generate-codes")
async def generate_codes(req: GenerateCodesRequest):
    if req.admin_key != ADMIN_KEY:
        raise HTTPException(403, "Yetkisiz")
    alphabet = string.ascii_uppercase + string.digits
    codes = []
    for _ in range(min(req.count, 50)):
        parts = ["".join(secrets.choice(alphabet) for _ in range(4)) for _ in range(3)]
        codes.append("-".join(parts))
    r = await _sb_insert("premium_codes", [{"code": c, "used": False} for c in codes])
    return {"codes": codes, "inserted": r.status_code in (200, 201)}


LANG_NAMES = {
    "tr": ("Türkçe", "Turkish"),
    "en": ("İngilizce", "English"),
    "es": ("İspanyolca", "Spanish"),
    "fr": ("Fransızca", "French"),
    "de": ("Almanca", "German"),
    "ar": ("Arapça", "Arabic"),
    "pt": ("Portekizce", "Portuguese"),
    "it": ("İtalyanca", "Italian"),
    "ru": ("Rusça", "Russian"),
    "ja": ("Japonca", "Japanese"),
    "ko": ("Korece", "Korean"),
    "zh-cn": ("Çince", "Chinese"),
    "zh": ("Çince", "Chinese"),
    "nl": ("Hollandaca", "Dutch"),
    "pl": ("Lehçe", "Polish"),
    "sv": ("İsveççe", "Swedish"),
    "hi": ("Hintçe", "Hindi"),
    "id": ("Endonezce", "Indonesian"),
    "fi": ("Fince", "Finnish"),
    "no": ("Norveççe", "Norwegian"),
    "da": ("Danimarkaca", "Danish"),
    "cs": ("Çekçe", "Czech"),
    "hu": ("Macarca", "Hungarian"),
    "ro": ("Romence", "Romanian"),
    "uk": ("Ukraynaca", "Ukrainian"),
    "el": ("Yunanca", "Greek"),
    "he": ("İbranice", "Hebrew"),
    "th": ("Tayca", "Thai"),
    "vi": ("Vietnamca", "Vietnamese"),
}

_translate_cache: dict = {}


@app.get("/translate")
async def translate_text(text: str = Query(...), target: str = Query("tr")):
    text = text.strip()
    if not text or len(text) > 500:
        raise HTTPException(400, "Metin 1-500 karakter arasında olmalı")

    cache_key = (text, target)
    if cache_key in _translate_cache:
        return _translate_cache[cache_key]

    try:
        from langdetect import detect, DetectorFactory
        DetectorFactory.seed = 0  # deterministic results
        source = detect(text)
        # langdetect misdetects short Turkish text as other languages;
        # if text is very short (< 20 chars) and target is the detected lang, trust MyMemory instead
        if len(text) < 20 and source not in ("en", "tr", "de", "fr", "es", "ar", "ru", "ja", "ko"):
            source = "und"  # undetermined — let MyMemory auto-detect
    except Exception:
        source = "und"

    if source != "und" and (source == target or source.split("-")[0] == target.split("-")[0]):
        return {"translated": text, "source": source, "same_language": True}

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            langpair = f"{source}|{target}" if source != "und" else f"autodetect|{target}"
            resp = await client.get(
                "https://api.mymemory.translated.net/get",
                params={"q": text, "langpair": langpair, "de": "gameeetv@gmail.com"}
            )
            data = resp.json()
            translated = data["responseData"]["translatedText"]
    except Exception as e:
        raise HTTPException(500, f"Çeviri hatası: {str(e)[:80]}")

    lang_tr, lang_en = LANG_NAMES.get(source, (source, source))
    result = {
        "translated": translated,
        "source": source,
        "source_name_tr": lang_tr,
        "source_name_en": lang_en,
        "same_language": False,
    }
    _translate_cache[cache_key] = result
    return result


SUPABASE_URL = os.getenv("SUPABASE_URL", "https://nwdwfwokdpjdkpsztuuo.supabase.co")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", os.getenv("SUPABASE_SERVICE_KEY", ""))


class ReportPayload(BaseModel):
    post_id: str | None = None
    reported_user_id: str | None = None
    reason: str
    details: str | None = None


@app.post("/report")
async def submit_report(payload: ReportPayload, request: Request):
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Unauthorized")
    user_token = auth.split(" ", 1)[1]

    # Verify the user JWT to get user id
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={"Authorization": f"Bearer {user_token}", "apikey": SUPABASE_SERVICE_KEY}
        )
        if r.status_code != 200:
            raise HTTPException(401, "Invalid token")
        reporter_id = r.json().get("id")

    if not reporter_id:
        raise HTTPException(401, "Could not identify user")

    # Insert with service role (bypasses RLS)
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.post(
            f"{SUPABASE_URL}/rest/v1/reports",
            headers={
                "apikey": SUPABASE_SERVICE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                "Content-Type": "application/json",
                "Prefer": "return=minimal",
            },
            json={
                "reporter_id": reporter_id,
                "post_id": payload.post_id,
                "reported_user_id": payload.reported_user_id,
                "reason": payload.reason,
                "details": payload.details,
            }
        )
        if r.status_code not in (200, 201):
            raise HTTPException(500, "Report gönderilemedi")

    return {"success": True}


@app.delete("/user")
async def delete_user_account(request: Request):
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Unauthorized")
    user_token = auth.split(" ", 1)[1]

    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={"Authorization": f"Bearer {user_token}", "apikey": SUPABASE_SERVICE_KEY}
        )
        if r.status_code != 200:
            raise HTTPException(401, "Invalid token")
        user_id = r.json().get("id")

    if not user_id:
        raise HTTPException(401, "Could not identify user")

    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.delete(
            f"{SUPABASE_URL}/auth/v1/admin/users/{user_id}",
            headers={
                "apikey": SUPABASE_SERVICE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            }
        )
        if r.status_code not in (200, 204):
            raise HTTPException(500, f"Hesap silinemedi")

    return {"success": True}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
