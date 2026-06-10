FROM --platform=linux/amd64 debian:bookworm

# Linaro GCC 4.9 — required for kernel 3.10 ARM inline asm (GCC 8+ incompatible)
ARG LINARO_URL=https://releases.linaro.org/components/toolchain/binaries/4.9-2017.01/arm-linux-gnueabi/gcc-linaro-4.9.4-2017.01-x86_64_arm-linux-gnueabi.tar.xz

RUN apt-get update -qq && \
    apt-get install -y -qq --no-install-recommends \
        build-essential bc curl xz-utils python3 ca-certificates && \
    rm -rf /var/lib/apt/lists/* && \
    ln -sf /usr/bin/python3 /usr/local/bin/python

RUN mkdir -p /opt/linaro && \
    curl -fsSL "${LINARO_URL}" | tar xJ --strip-components=1 -C /opt/linaro

ENV PATH="/opt/linaro/bin:${PATH}" \
    ARCH=arm \
    CROSS_COMPILE=arm-linux-gnueabi-
