# Deployment Guide: Ubuntu VPS Setup

This document outlines the step-by-step procedure to deploy the **WhatsApp Number Checker & Duplicate Remover Pro** application on an Ubuntu VPS using Docker, Docker Compose, and Nginx reverse proxy with Let's Encrypt SSL certificates.

---

## Prerequisites

Ensure your Ubuntu server is up to date:
```bash
sudo apt update && sudo apt upgrade -y
```

Install Docker and Docker Compose:
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo apt-get install docker-compose-plugin -y
```

---

## Project Structure & Cloning

1. Clone your project files to the `/var/www/` directory on the VPS:
   ```bash
   sudo mkdir -p /var/www/whatsapp-checker
   sudo chown -R $USER:$USER /var/www/whatsapp-checker
   cd /var/www/whatsapp-checker
   # Copy or git pull repository files here
   ```

2. Create a production `.env` configuration:
   ```bash
   cp .env.example .env
   nano .env
   ```
   Set secure variables (especially `SECRET_KEY`, `REFRESH_SECRET_KEY`, and `ENCRYPTION_KEY`).

---

## Running with Docker Compose

Build and spin up all application microservices:
```bash
docker compose up --build -d
```

Verify that all service containers are healthy and running:
```bash
docker compose ps
```

---

## Configuring SSL with Nginx and Certbot

To secure your installation with an SSL certificate:

1. Install Certbot on the host:
   ```bash
   sudo apt install certbot python3-certbot-nginx -y
   ```

2. Configure a host Nginx reverse proxy pointing to the Nginx Docker container. Update the host `/etc/nginx/sites-available/default` file:
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com; # Replace with your actual domain

       location / {
           proxy_pass http://localhost:80; # Points to whatsapp_checker_nginx container
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

3. Obtain Let's Encrypt SSL certificate:
   ```bash
   sudo systemctl stop nginx # Temporarily stop host nginx if active
   sudo certbot --nginx -d yourdomain.com
   ```

4. Certbot will automatically rewrite the Nginx configuration to support HTTPS (port 443) and force redirections. Start host Nginx:
   ```bash
   sudo systemctl restart nginx
   ```

---

## Monitoring Logs

- **Backend logs**: `docker compose logs backend`
- **Worker logs**: `docker compose logs worker`
- **Nginx logs**: `docker compose logs nginx`
- **All logs**: `docker compose logs -f`
