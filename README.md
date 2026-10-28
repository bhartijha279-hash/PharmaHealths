# PharmaHealth 💊🏥

PharmaHealth is a comprehensive modern pharmaceutical and healthcare management platform built with Spring Boot (Java), React, MySQL, JWT Authentication, and Docker.

---

## 🏗️ Architecture & Tech Stack

- **Backend**:
  - Java 21 / 25
  - Spring Boot 3.3.x (Spring Web, Spring Security, Spring Data JPA)
  - Maven
  - JWT Authentication & Authorization (`io.jsonwebtoken`)
  - MySQL Database connector & Hibernate ORM
  - RESTful APIs with Swagger/OpenAPI documentation
- **Frontend**:
  - React 18+ (Vite)
  - Bootstrap 5 & Bootstrap Icons
  - Axios for API communication
  - React Router for seamless navigation
- **Static Page**:
  - High-performance responsive static landing & showcase page
- **DevOps & Containers**:
  - Docker & Docker Compose
  - Render Deployment Blueprint (`render.yaml`)
  - GitHub Actions CI/CD (`.github/workflows/ci.yml`)

---

## 📁 Repository Structure

```text
PharmaHealth/
├── .github/
│   └── workflows/
│       └── ci.yml               # GitHub Actions CI workflow
├── backend/                     # Spring Boot Maven application
│   ├── src/                     # Java source code and resources
│   ├── pom.xml                  # Maven dependencies & plugins
│   └── Dockerfile               # Backend container definition
├── frontend/                    # React + Vite + Bootstrap application
│   ├── src/                     # Components, pages, services, styling
│   ├── package.json             # NPM dependencies
│   └── Dockerfile               # Frontend container definition
├── static-page/                 # Static marketing / showcase landing page
│   ├── index.html
│   ├── css/style.css
│   └── assets/
├── .gitignore                   # Multi-language git ignore
├── database.sql                 # MySQL schema creation and seed data
├── docker-compose.yml           # Multi-service local environment setup
├── Dockerfile                   # Multi-stage production container build
├── README.md                    # Project documentation
└── render.yaml                  # Render cloud deployment blueprint
```

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Git**
- **Docker & Docker Compose** (Recommended for full-stack run)
- **Java 21+** & **Maven**
- **Node.js 20+** & **npm**
- **MySQL 8.0**

### 2. Run with Docker Compose (Fastest)

```bash
docker-compose up --build
```

- **Backend API**: http://localhost:8080
- **Frontend App**: http://localhost:3000
- **MySQL**: localhost:3306

### 3. Running Backend Locally

```bash
cd backend
mvn spring-boot:run
```

The Spring Boot backend connects to MySQL with credentials defined in `application.properties`.

### 4. Running Frontend Locally

```bash
cd frontend
npm install
npm run dev
```

Visit [http://localhost:5173](http://localhost:5173).

---

## ☁️ Deploying on Render with Aiven MySQL Database

### 1. Set up Aiven MySQL Database
1. Go to [Aiven Console](https://console.aiven.io/) and create a free MySQL service (e.g., `mysql-pharmahealth`).
2. Once the service is running, open the **Overview** tab:
   - Note down **Host**, **Port**, **User** (`avnadmin`), and **Password**.
   - Note down the **Service URI**.
3. Initialize the schema & seed data:
   - Open Aiven's web **Query Editor** (or connect via MySQL Workbench / DBeaver / CLI using the Service URI).
   - Run the script contents from [`database.sql`](file:///c:/PharmaHealth/database.sql).

### 2. Connect Backend to Aiven on Render
When deploying the blueprint via `render.yaml` or setting environment variables on the Render Dashboard for `pharmahealth-backend`:

| Environment Variable | Example Value | Description |
|---|---|---|
| `SPRING_DATASOURCE_URL` | `jdbc:mysql://<AIVEN_HOST>:<AIVEN_PORT>/defaultdb?sslMode=REQUIRED` | Aiven JDBC URL with SSL enabled |
| `SPRING_DATASOURCE_USERNAME` | `avnadmin` | Default Aiven administrative user |
| `SPRING_DATASOURCE_PASSWORD` | `<your-aiven-password>` | Generated Aiven password |
| `JWT_SECRET` | *(Auto-generated or custom 64-char key)* | Secret for signing auth tokens |
| `SPRING_PROFILES_ACTIVE` | `prod` | Production Spring profile |

### 3. Deploy via Blueprint on Render
1. Go to [Render Dashboard](https://dashboard.render.com/) -> **New** -> **Blueprint**.
2. Connect your repository: `https://github.com/ayushpalg46/PharmaHealth.git`.
3. Render reads [`render.yaml`](file:///c:/PharmaHealth/render.yaml) automatically:
   - Sets up the Spring Boot Web Service (`pharmahealth-backend`).
   - Sets up the Single Unified React Frontend (`pharmahealth-frontend`).
4. Enter your Aiven password when prompted for `SPRING_DATASOURCE_PASSWORD`.
5. Click **Apply** to deploy!

---

## 🔐 Default Seed Credentials

| Role | Username | Password |
|---|---|---|
| **Admin** | `admin` | `admin123` |
| **Customer** | `rohit.sharma` | `password123` |
| **Customer** | `ananya.verma` | `password123` |
| **Customer** | `rahul.mehta` | `password123` |

Additional admin/pharmacist accounts can be created by an admin from the dashboard (`POST /api/users/create-admin`).

---

## 📄 License
MIT License.
