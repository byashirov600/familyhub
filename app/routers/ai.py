import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/ai", tags=["ai"])


class TextRequest(BaseModel):
    text: str


@router.post("/improve")
async def improve_text(request: TextRequest):
    """Улучшает текст поста с помощью локальной LLM (Ollama)"""

    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Текст не может быть пустым")

    # Промпт для ИИ: задаем роль и задачу
    prompt = (
        "Ты — опытный редактор постов в социальной сети. Твоя задача — переписать исходный текст так, "
        "чтобы он звучал естественно, грамотно, живо и по-человечески.\n\n"
        "СТРОГИЕ ПРАВИЛА:\n"
        "1. Пиши ИСКЛЮЧИТЕЛЬНО на русском языке. Никаких иностранных слов.\n"
        "2. Исправь грамматические, пунктуационные и стилистические ошибки.\n"
        "3. Сделай текст более тёплым, живым или слегка ироничным (если это уместно по тону оригинала).\n"
        "4. Можешь добавить 1-2 уместных эмодзи для живости.\n"
        "5. ЗАПРЕЩЕНО придумывать новые факты, детали или события, которых не было в оригинале.\n"
        "6. ЗАПРЕЩЕНО писать вводные фразы типа 'Конечно', 'Вот ваш текст', 'Я улучшил'. Просто верни готовый результат.\n\n"
        f"Исходный текст: \"{request.text}\""
    )

    payload = {
        "model":  "qwen2.5:7b",  # Легкая и быстрая модель. Можно заменить на "qwen2.5" или "llama3"
        "prompt": prompt,
        "stream": False
    }

    try:
        # Обращаемся к сервису ollama внутри Docker-сети по имени 'ollama'
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post("http://ollama:11434/api/generate", json=payload)
            response.raise_for_status()
            data = response.json()

            # Ollama возвращает ответ в поле "response"
            improved_text = data.get("response", "").strip()

            if not improved_text:
                raise HTTPException(status_code=500, detail="ИИ вернул пустой ответ")

            return {"improved_text": improved_text}

    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="ИИ думает слишком долго. Попробуйте еще раз.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка ИИ-сервиса: {str(e)}")