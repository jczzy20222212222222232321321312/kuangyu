# 外网访问部署

当前本机服务：

```text
静态页面 0.0.0.0:8080
游戏 API/SSE 0.0.0.0:8091
自签名 TLS 代理 0.0.0.0:8443
PostgreSQL 127.0.0.1:554xx
Redis 127.0.0.1:564xx
```

不要把 PostgreSQL 或 Redis 暴露到公网。

## 方案 A：有公网服务器/域名（推荐）

用 Caddy 同时提供 HTTPS、静态页面和 `/world` API 反向代理。

```caddyfile
game.example.com {
    root * /srv/kuangyu
    file_server

    handle_path /world/* {
        reverse_proxy 127.0.0.1:8091
    }
}
```

启动：

```bash
caddy run --config Caddyfile
```

外网访问：

```text
https://game.example.com/
```

页面在 HTTPS 下会自动把 API 地址设为 `/world`，与网页同源，不需要额外写 `?server=`。

DNS 将 `game.example.com` 指向服务器公网 IP，防火墙只开放 80/443。

## 方案 B：没有公网 IP，用 Cloudflare Tunnel

1. 用 Caddy 在本机提供一个 HTTP 反向代理：

```caddyfile
:8081 {
    root * /srv/kuangyu
    file_server

    handle_path /world/* {
        reverse_proxy 127.0.0.1:8091
    }
}
```

2. 启动隧道：

```bash
cloudflared tunnel --url http://127.0.0.1:8081
```

3. 把 Cloudflare 给出的 HTTPS 地址作为外网入口。

Cloudflare 负责公网 TLS；本机只监听 8081 和 8091。

## 方案 C：临时端口映射（不推荐正式使用）

路由器把公网 `443` 转发到本机 `8443`，使用：

```text
https://你的公网IP:8443/
```

当前 8443 是自签名证书，浏览器和部分钱包会报证书错误，只适合临时测试。


## 没有域名、只给熟人临时访问

已提供单端口 HTTP 代理：

```bash
node server/http-proxy.js
```

它监听：

```text
127.0.0.1:8081
```

并把：

```text
/world/*  -> 127.0.0.1:8091
其他路径  -> 127.0.0.1:8080
```

然后任选一个隧道工具：

### Cloudflare 临时隧道

```bash
cloudflared tunnel --url http://127.0.0.1:8081
```

它会输出：

```text
https://随机名称.trycloudflare.com
```

把这个 HTTPS 地址发给熟人即可。无需域名、无需路由器端口映射，数据库也不会暴露。

### ngrok

```bash
ngrok http 8081
```

同样会给出一个 HTTPS 地址。

页面在 HTTPS 下会自动使用同源的 `/world`，所以不需要额外参数。

注意：Cloudflare 临时隧道地址通常会在隧道重启后变化。需要固定地址时，仍然需要命名隧道或域名。

## 必需检查

- 服务器进程监听 `0.0.0.0:8091`
- 静态页面由 Caddy/Nginx 提供
- `/world/health` 能通过外网 HTTPS 访问
- SSE `/world/events` 不被代理缓冲
- `/world` 代理关闭缓冲：

```nginx
location /world/ {
    proxy_pass http://127.0.0.1:8091/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 3600s;
}
```

## 安全

- 不要把 554xx/564xx 端口映射到公网
- 不要把 `/tmp/kuangyu-deployer.json` 放到 Web 根目录
- 使用 HTTPS 正式证书
- 当前仍是 BSC 测试网
- 市场合约地址、NFT V2 地址和 ORE 地址见 `build/`
