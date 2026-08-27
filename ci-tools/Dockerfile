FROM docker:27-cli

USER root

ARG INFISICAL_VERSION=0.43.124

RUN apk add --no-cache bash ca-certificates openssh-client tar wget \
    && mkdir -p /tmp/infisical \
    && wget -q "https://github.com/Infisical/cli/releases/download/v${INFISICAL_VERSION}/cli_${INFISICAL_VERSION}_linux_amd64.tar.gz" -O /tmp/infisical.tar.gz \
    && tar -xzf /tmp/infisical.tar.gz -C /tmp/infisical \
    && install -m 0755 "$(find /tmp/infisical -type f -name infisical -print -quit)" /usr/local/bin/infisical \
    && rm -rf /tmp/infisical /tmp/infisical.tar.gz \
    && infisical --version

WORKDIR /workspace

ENTRYPOINT []
