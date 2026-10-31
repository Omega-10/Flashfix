FROM nginx:1.27-alpine

# Remove default configuration
RUN rm -f /etc/nginx/conf.d/default.conf

# Copy Flashfix API Gateway configuration (supports both repo root and infra/nginx build contexts)
COPY infra/nginx/nginx.con[f] nginx.con[f] /etc/nginx/
COPY infra/nginx/docker-entrypoint.s[h] docker-entrypoint.s[h] /docker-entrypoint.d/40-dynamic-upstreams.sh
RUN chmod +x /docker-entrypoint.d/40-dynamic-upstreams.sh 2>/dev/null || true

# Copy templates directory for Nginx template engine support
COPY infra/nginx/template[s] template[s] /etc/nginx/templates/

EXPOSE 80

STOPSIGNAL SIGQUIT

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -q -O - http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
