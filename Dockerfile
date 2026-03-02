# Entware build environment for EE71
# Based on Entware's official Docker setup (github.com/Entware/docker)
# Native toolchain: GCC 13.4.0, binutils 2.34, glibc 2.17
#
# Build:  docker build -f Dockerfile.entware -t ee71-entware .
# Usage:  ./build_entware.sh setup && ./build_entware.sh toolchain

# Main build environment
FROM debian:bookworm-slim

ARG DEBIAN_FRONTEND=noninteractive

# Fake python2.7 stub (Entware prereq check needs "Python 2" in -V output;
# actual python2 only used for node_legacy which we don't build)
RUN printf '#!/bin/sh\necho "Python 2.7.18"\n' > /usr/bin/python2.7 \
    && chmod 755 /usr/bin/python2.7 \
    && ln -sf /usr/bin/python2.7 /usr/bin/python2

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gawk \
    git \
    gettext \
    unzip \
    python3 \
    python3-distutils \
    python-is-python3 \
    rsync \
    file \
    wget \
    curl \
    libncurses-dev \
    zlib1g-dev \
    libssl-dev \
    libelf-dev \
    libc6-dev \
    ca-certificates \
    xz-utils \
    bzip2 \
    patch \
    quilt \
    sudo \
    locales \
    && rm -rf /var/lib/apt/lists/* \
    && localedef -i en_US -c -f UTF-8 -A /usr/share/locale/locale.alias en_US.UTF-8

ENV LANG=en_US.utf8
ENV FORCE_UNSAFE_CONFIGURE=1

WORKDIR /entware
