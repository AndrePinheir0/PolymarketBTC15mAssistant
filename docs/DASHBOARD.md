# Paper Trading Dashboard

## Ver localmente

O dashboard é um ficheiro HTML estático (`src/index.html`) que lê o ficheiro `logs/paper_trades.csv` via `fetch`. Por isso precisa de correr atrás de um servidor HTTP — abrir o ficheiro directamente no browser (`file://`) não funciona devido a restrições CORS.

### Opção 1 — Python (sem instalar nada)

Na raiz do projecto:

```bash
python3 -m http.server 8080
```

Abre o browser em:

```
http://localhost:8080/src/index.html
```

### Opção 2 — Node `serve`

```bash
npx serve . -p 8080
```

Abre o browser em:

```
http://localhost:8080/src/index.html
```

### Opção 3 — VS Code Live Server

Instala a extensão [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer), clica com o botão direito em `src/index.html` → **Open with Live Server**.

---

### Recarregar dados

O dashboard tem um botão **↻ Reload** no canto superior direito que refaz o fetch ao CSV sem recarregar a página.

Para actualizações automáticas, podes usar um loop no terminal:

```bash
# Abrir o servidor e recarregar o browser a cada 60s (macOS)
while true; do sleep 60 && osascript -e 'tell application "Google Chrome" to reload active tab of front window'; done
```

---

## Deploy para servidor

### Pré-requisitos no servidor

- Linux (Ubuntu 22.04+ recomendado)
- Node.js 18+
- `nginx` ou `caddy` para servir o HTML
- O bot a correr como serviço (`systemd`)

---

### 1. Copiar o projecto para o servidor

```bash
rsync -avz --exclude node_modules --exclude .env \
  /caminho/local/PolymarketBTC15mAssistant/ \
  user@servidor:/opt/polybot/
```

No servidor, instalar dependências:

```bash
cd /opt/polybot && npm install
```

---

### 2. Criar o ficheiro `.env` no servidor

```bash
nano /opt/polybot/.env
```

```env
PAPER_ENABLED=true
PAPER_STARTING_BALANCE=1000
PAPER_BET_PCT=5
PAPER_MIN_ENTRY_PRICE=0.50
PAPER_MAX_ENTRY_PRICE=0.65
PAPER_TAKE_PROFIT_PCT=50
PAPER_STOP_LOSS_PCT=15
PAPER_EDGE_EXIT_THRESHOLD=-0.02
PAPER_FLIP_MIN_PROB=0.75
PAPER_FLIP_MIN_EDGE=0.20

POLYGON_RPC_URL=https://polygon-rpc.com
POLYGON_RPC_URLS=https://polygon-rpc.com,https://rpc.ankr.com/polygon
POLYGON_WSS_URL=wss://polygon-bor-rpc.publicnode.com
POLYGON_WSS_URLS=wss://polygon-bor-rpc.publicnode.com,wss://polygon.drpc.org
```

---

### 3. Criar serviço systemd para o bot

```bash
sudo nano /etc/systemd/system/polybot.service
```

```ini
[Unit]
Description=Polymarket BTC 15m Bot
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/polybot
ExecStart=/usr/bin/node src/index.js
Restart=on-failure
RestartSec=10
EnvironmentFile=/opt/polybot/.env

[Install]
WantedBy=multi-user.target
```

Activar e arrancar:

```bash
sudo systemctl daemon-reload
sudo systemctl enable polybot
sudo systemctl start polybot
sudo systemctl status polybot
```

Ver logs do bot:

```bash
journalctl -u polybot -f
```

---

### 4. Servir o dashboard com nginx

O nginx serve o `src/index.html` e os `logs/` estaticamente.

```bash
sudo apt install nginx -y
sudo nano /etc/nginx/sites-available/polybot
```

```nginx
server {
    listen 80;
    server_name SEU_DOMINIO_OU_IP;

    root /opt/polybot;
    index src/index.html;

    # Dashboard
    location / {
        try_files $uri $uri/ /src/index.html;
    }

    # Logs CSV (necessário para o fetch do dashboard)
    location /logs/ {
        alias /opt/polybot/logs/;
        add_header Cache-Control "no-cache";
    }

    # Bloquear acesso ao .env
    location ~ /\.env {
        deny all;
    }
}
```

Activar:

```bash
sudo ln -s /etc/nginx/sites-available/polybot /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Dashboard disponível em `http://SEU_DOMINIO_OU_IP/src/index.html`.

---

### 5. HTTPS com Certbot (opcional mas recomendado)

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d SEU_DOMINIO
```

O certbot configura o HTTPS e redireccionamento automático de HTTP para HTTPS.

---

### 6. Autenticação básica (recomendado se o servidor for público)

Para proteger o dashboard com password:

```bash
sudo apt install apache2-utils -y
sudo htpasswd -c /etc/nginx/.htpasswd SEU_UTILIZADOR
```

Adicionar ao bloco `location /` no nginx:

```nginx
location / {
    auth_basic "Polybot Dashboard";
    auth_basic_user_file /etc/nginx/.htpasswd;
    try_files $uri $uri/ /src/index.html;
}
```

```bash
sudo systemctl reload nginx
```

---

## Estrutura de ficheiros relevante

```
PolymarketBTC15mAssistant/
├── src/
│   └── index.html          # Dashboard (abre isto no browser)
├── logs/
│   ├── paper_trades.csv    # Fonte de dados do dashboard
│   ├── paper_state.json    # Estado actual do bot
│   └── paper_log.txt       # Log textual de todos os trades
└── .env                    # Configuração (nunca expor publicamente)
```
