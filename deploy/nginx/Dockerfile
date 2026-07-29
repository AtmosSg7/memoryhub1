# syntax=docker/dockerfile:1

FROM nginx:1.27-alpine

RUN apk add --no-cache curl openssl \
    && apk add --no-cache nginx-mod-http-brotli || true

RUN touch /etc/nginx/modules-brotli.conf \
    && if [ -f /usr/lib/nginx/modules/ngx_http_brotli_filter_module.so ]; then \
         printf 'load_module modules/ngx_http_brotli_filter_module.so;\nload_module modules/ngx_http_brotli_static_module.so;\n' > /etc/nginx/modules-brotli.conf; \
       else \
         printf '# Brotli not available in this image\n' > /etc/nginx/snippets/brotli.conf; \
       fi

COPY nginx.conf /etc/nginx/nginx.conf
COPY conf.d/ /etc/nginx/conf.d/
COPY snippets/ /etc/nginx/snippets/
COPY docker-entrypoint.sh /docker-entrypoint.sh

RUN chmod +x /docker-entrypoint.sh

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8080/health || exit 1

EXPOSE 80 443 8080

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
