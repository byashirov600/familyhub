#  FamilyHub API

Полноценный async REST API для семейной социальной сети с аутентификацией, лентой постов, комментариями, лайками и Docker-контейнеризацией.

![Python](https://img.shields.io/badge/Python-3.13-blue?logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791?logo=postgresql)
![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker)
![License](https://img.shields.io/badge/License-MIT-green)

##  О проекте

FamilyHub — это backend для семейной социальной сети, где члены семьи могут делиться фотографиями, новостями и общаться. Проект демонстрирует навыки современной backend-разработки: асинхронность, контейнеризация, REST API, JWT-аутентификация.

## ✨ Возможности

-  **JWT-аутентификация** — безопасная регистрация и вход с хешированием паролей (bcrypt)
- 📝 **CRUD постов** — создание, чтение, обновление, удаление постов с загрузкой изображений
- 💬 **Комментарии и лайки** — интерактивность с защитой от дубликатов
- 🐳 **Docker Compose** — запуск приложения и PostgreSQL одной командой
- ⚡ **Асинхронность** — FastAPI + asyncpg для высокой производительности
- 🛡️ **Валидация данных** — Pydantic V2 с типизацией

## 🛠️ Технологический стек

| Категория | Технологии |
|-----------|-----------|
| Язык | Python 3.13 |
| Фреймворк | FastAPI |
| База данных | PostgreSQL 15 |
| ORM | SQLAlchemy (async) |
| Контейнеризация | Docker, Docker Compose |
| Аутентификация | JWT (python-jose) |
| Хеширование | passlib + bcrypt |

## 📂 Структура проекта
```
familyhub/
├── app/
│ ├── models/ # SQLAlchemy модели (User, Post, Comment, Like)
│ ├── schemas/ # Pydantic схемы для валидации запросов/ответов
│ ├── routers/ # API эндпоинты (auth, users, posts, comments, likes)
│ ├── database.py # Асинхронное подключение к PostgreSQL
│ ├── config.py # Управление переменными окружения (pydantic-settings)
│ ├── utils.py # Утилиты (хеширование паролей, JWT)
│ └── main.py # Точка входа приложения
├── uploads/ # Директория для загруженных изображений
├── docker-compose.yml # Оркестрация контейнеров (App + PostgreSQL)
├── Dockerfile # Инструкции для сборки образа приложения
├── requirements.txt # Зависимости Python
└── .env.example # Шаблон переменных окружения
```

## 🚀 Быстрый старт

### Предварительные требования
- [Docker](https://www.docker.com/products/docker-desktop/) и Docker Compose
- Python 3.13+ (для локального запуска)

1. Клонируйте репозиторий
```bash
git clone https://github.com/byashirov600/familyhub.git
cd familyhub
```
2. Настройте окружение
Создайте файл .env на основе .env.example:```
cp .env.example .env
Отредактируйте .env и задайте свой SECRET_KEY:
DATABASE_URL=postgresql+asyncpg://user:password@postgres:5432/familyhub_db
SECRET_KEY=ваш_случайный_секретный_ключ ```
3. Запустите через Docker Compose
docker-compose up --build
Приложение будет доступно по адресу: http://127.0.0.1:8000
4. Откройте документацию API
Интерактивная Swagger UI документация:
👉 http://127.0.0.1:8000/docs ```