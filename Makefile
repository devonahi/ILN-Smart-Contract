.PHONY: build test fuzz changelog

build:
	cargo build --target wasm32v1-none --release

test:
	cargo test

fuzz:
	cargo test -p iln_fuzz

# Generate CHANGELOG.md from conventional commits using git-cliff.
# Install: cargo install git-cliff
# Usage:
#   make changelog          # update for unreleased commits
#   make changelog TAG=v1.0.0  # generate up to a specific tag
changelog:
	git cliff $(if $(TAG),--tag $(TAG)) --output CHANGELOG.md
