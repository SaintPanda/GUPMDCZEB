# Молекула Знань

Інтерактивна молекулярна система знань з 3D нейронною візуалізацією.
Дані зберігаються у Firebase Firestore. Публічний перегляд — для всіх. Редагування — лише для автора.

---

## Структура проєкту

```
mol-knowledge/
├── index.html              ← головна сторінка
├── css/
│   └── style.css           ← всі стилі
├── js/
│   ├── firebase.js         ← Firebase ініціалізація + CRUD
│   ├── canvas.js           ← 3D рендеринг (фон + сфера)
│   └── app.js              ← UI логіка, редактор, авторизація
├── firebase.json           ← конфіг Firebase Hosting
├── .firebaserc             ← alias проєкту
├── firestore.rules         ← правила безпеки Firestore
├── .github/
│   └── workflows/
│       └── deploy.yml      ← GitHub Actions → GitHub Pages
└── README.md
```

---

## Деплой через GitHub Pages (рекомендовано)

### 1. Створити репозиторій

```bash
git init
git add .
git commit -m "init: molecular knowledge system"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/mol-knowledge.git
git push -u origin main
```

### 2. Увімкнути GitHub Pages

У репозиторії: **Settings → Pages → Source → GitHub Actions**

Після першого `push` до `main` → сайт буде доступний за адресою:
```
https://YOUR_USERNAME.github.io/mol-knowledge/
```

---

## Деплой через Firebase Hosting (альтернатива)

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only hosting
```

Сайт буде доступний за адресою:
```
https://gupmdczeb.web.app
```

---

## Налаштування Firestore

### Увімкнути Firestore у Firebase Console

1. Відкрити [Firebase Console](https://console.firebase.google.com/project/gupmdczeb)
2. **Firestore Database → Create database → Start in production mode**
3. Обрати регіон (наприклад `europe-west1`)

### Застосувати правила безпеки

```bash
firebase deploy --only firestore:rules
```

Або вручну у консолі вставити вміст `firestore.rules`.

---

## Використання

| Дія | Як |
|-----|----|
| Обертати сферу | Зажати мишку + тягнути |
| Zoom | Колесо миші |
| Відкрити ноду | Клік |
| Заглибитись | Подвійний клік |
| Назад | Клік на порожньому місці |
| Контекстне меню | ПКМ на ноді |
| Режим автора | Кнопка «Автор» → пароль |

**Пароль автора:** `author2024`

---

## Технології

- Vanilla JS (ES Modules) — без фреймворків
- Firebase Firestore — real-time backend
- Canvas API — 3D рендеринг
- GitHub Actions — CI/CD
