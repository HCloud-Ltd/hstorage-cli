#!/bin/sh
set -eu

REPO="HCloud-Ltd/hstorage-cli"
BINARY_NAME="hcli"

main() {
  os=$(detect_os)
  arch=$(detect_arch)

  base="${BINARY_NAME}-${os}-${arch}"
  zip_asset="${base}.zip"

  if [ "$os" = "windows" ]; then
    binary_name="${base}.exe"
  else
    binary_name="${base}"
  fi

  version=$(resolve_version)
  url="https://github.com/${REPO}/releases/download/${version}/${zip_asset}"

  install_dir=$(resolve_install_dir)
  target="${install_dir}/${BINARY_NAME}"

  tmpdir=$(mktemp -d)
  trap 'rm -rf "$tmpdir"' EXIT

  echo "Downloading ${BINARY_NAME} ${version} (${os}/${arch})..."
  download "$url" "${tmpdir}/${zip_asset}"

  unzip -qo "${tmpdir}/${zip_asset}" -d "${tmpdir}"
  chmod +x "${tmpdir}/${binary_name}"
  mv "${tmpdir}/${binary_name}" "${tmpdir}/${BINARY_NAME}"

  echo "Installing to ${target}..."
  install_binary "${tmpdir}/${BINARY_NAME}" "$target"

  echo ""
  echo "${BINARY_NAME} ${version} has been installed to ${target}"
  echo "Run '${BINARY_NAME} --help' to get started."
}

detect_os() {
  case "$(uname -s)" in
    Linux*)  echo "linux" ;;
    Darwin*) echo "darwin" ;;
    MINGW*|MSYS*|CYGWIN*) echo "windows" ;;
    *) echo "Unsupported OS: $(uname -s)" >&2; exit 1 ;;
  esac
}

detect_arch() {
  case "$(uname -m)" in
    x86_64|amd64)  echo "amd64" ;;
    aarch64|arm64) echo "arm64" ;;
    *) echo "Unsupported architecture: $(uname -m)" >&2; exit 1 ;;
  esac
}

resolve_version() {
  if [ -n "${HCLI_VERSION:-}" ]; then
    echo "$HCLI_VERSION"
    return
  fi

  if command -v curl >/dev/null 2>&1; then
    url=$(curl -fsSL -o /dev/null -w '%{url_effective}' "https://github.com/${REPO}/releases/latest" 2>/dev/null || true)
  elif command -v wget >/dev/null 2>&1; then
    url=$(wget -q -O /dev/null --server-response "https://github.com/${REPO}/releases/latest" 2>&1 | grep -i 'location:' | tail -1 | awk '{print $2}' | tr -d '\r' || true)
  fi

  if [ -z "${url:-}" ]; then
    echo "Failed to resolve latest version. Set HCLI_VERSION=vX.Y.Z and retry." >&2
    exit 1
  fi

  echo "$url" | grep -oE 'v[0-9]+\.[0-9]+\.[0-9]+' | tail -1
}

resolve_install_dir() {
  if [ -n "${HCLI_INSTALL_DIR:-}" ]; then
    mkdir -p "$HCLI_INSTALL_DIR"
    echo "$HCLI_INSTALL_DIR"
    return
  fi

  if [ -w "/usr/local/bin" ]; then
    echo "/usr/local/bin"
    return
  fi

  local_bin="${HOME}/.local/bin"
  mkdir -p "$local_bin"
  echo "$local_bin"

  case ":${PATH}:" in
    *":${local_bin}:"*) ;;
    *)
      echo ""
      echo "WARNING: ${local_bin} is not in your PATH."
      echo "Add the following to your shell profile:"
      echo ""
      echo "  export PATH=\"${local_bin}:\$PATH\""
      echo ""
      ;;
  esac
}

download() {
  url="$1"
  dest="$2"

  if command -v curl >/dev/null 2>&1; then
    curl -fsSL -o "$dest" "$url"
  elif command -v wget >/dev/null 2>&1; then
    wget -qO "$dest" "$url"
  else
    echo "curl or wget is required." >&2
    exit 1
  fi
}

install_binary() {
  src="$1"
  dest="$2"

  if [ -w "$(dirname "$dest")" ]; then
    mv "$src" "$dest"
  else
    echo "Elevated permissions required to install to $(dirname "$dest")."
    sudo mv "$src" "$dest"
  fi
}

main
