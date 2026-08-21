# How to Run LabHive UI

LabHive UI is the Angular 21 frontend for the LabHive laboratory management API.

## Prerequisites

| Tool | Version |
|---|---|
| Node.js (via nvm) | 24 LTS or later |
| npm | 11+ |
| Angular CLI | 21+ |
| LabHive backend | running on `http://127.0.0.1:5000` |

---

## 1. Start the LabHive Backend

The frontend requires the LabHive API to be running. Follow the steps in
[LabHive/HOW_TO_RUN.md](../labhive/HOW_TO_RUN.md), then verify it is up:

```bash
curl http://127.0.0.1:5000/labs
# should return [] or a JSON array (may require a JWT token)
```

---

## 2. Install Node.js (first time only)

If Node.js is not installed, use **nvm**:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc          # or restart the terminal
nvm install --lts
```

---

## 3. Install dependencies

```bash
cd labhive-ui
npm install
```

---

## 4. Run the development server

```bash
npx ng serve
# or, if Angular CLI is installed globally:
ng serve
```

Open **http://localhost:4200** in your browser.
The app hot-reloads on every source file change.

---

## 5. First-time setup (register a super-admin)

If the LabHive database is empty, navigate to **http://localhost:4200/register**
to create the first account. The first registration via the API is automatically
granted super-admin privileges.

> **Password requirement:** minimum 8 characters.

After registering, you will be redirected to the lab dashboard.

---

## 6. Build for production

```bash
ng build
# output goes to dist/labhive-ui/
```

---

## Environment configuration

The API base URL is configured in:

- `src/environments/environment.ts` — development
- `src/environments/environment.prod.ts` — production build

Edit `apiUrl` in either file to point to a different backend:

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://127.0.0.1:5000',
};
```

---

## Project structure

```
src/
  environments/         # API URL config
  app/
    core/
      models/           # TypeScript interfaces & enums
      auth/             # AuthService, JWT interceptor, AuthGuard
      services/         # One service per API resource
    shared/
      components/       # Navbar, RoleBadge, ConfirmDialog
    features/
      auth/             # Login, Register pages
      laboratories/     # LabList, LabDetail (tabbed view)
      members/          # MemberProfile
      projects/         # ProjectDetail
      research/         # ResearchDetail
      articles/         # ArticleDetail, ArticleForm
```

## Key routes

| URL | Page | Auth |
|---|---|---|
| `/login` | Sign in | Public |
| `/register` | Create account | Public |
| `/labs` | Lab dashboard | Required |
| `/labs/:id` | Lab detail (Members / Projects / Research / Articles tabs) | Required |
| `/labs/:id/projects/:pid` | Project detail + member management | Required |
| `/labs/:id/research/:rid` | Research group detail + member management | Required |
| `/labs/:id/articles/new` | Create article | Required |
| `/labs/:id/articles/:aid` | Article detail + authors | Required |
| `/profile` | Edit own profile / change password | Required |
