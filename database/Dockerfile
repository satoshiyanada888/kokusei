FROM postgres:16-alpine

RUN apk add --no-cache ca-certificates curl
COPY migrations /migrations
COPY migrate.sh /usr/local/bin/kokusei-migrate
COPY production /production
COPY validate-production-data.sh /usr/local/bin/kokusei-validate-production-data
COPY smoke-test.sh /usr/local/bin/kokusei-smoke-test
RUN chmod 0555 /usr/local/bin/kokusei-migrate \
    /usr/local/bin/kokusei-validate-production-data \
    /usr/local/bin/kokusei-smoke-test \
    && chown -R postgres:postgres /migrations

USER postgres
ENTRYPOINT ["/usr/local/bin/kokusei-migrate"]
