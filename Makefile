# Nospeak Makefile
# Supports Linux and macOS

# Variables
BINARY_NAME=nospeak
BUILD_DIR=build
PREFIX?=/usr/local
BINDIR=$(PREFIX)/bin

# Go flags
GO_FLAGS=-ldflags="-s -w"
GO_BUILD=go build $(GO_FLAGS)

# Detect OS
UNAME_S := $(shell uname -s)
UNAME_M := $(shell uname -m)

# Set architecture-specific flags
ifeq ($(UNAME_S),Linux)
    ifeq ($(UNAME_M),x86_64)
        ARCH=amd64
    else ifeq ($(UNAME_M),aarch64)
        ARCH=arm64
    else ifeq ($(UNAME_M),armv7l)
        ARCH=arm
    else
        ARCH=$(UNAME_M)
    endif
    OS=linux
endif

ifeq ($(UNAME_S),Darwin)
    ifeq ($(UNAME_M),x86_64)
        ARCH=amd64
    else ifeq ($(UNAME_M),arm64)
        ARCH=arm64
    else
        ARCH=$(UNAME_M)
    endif
    OS=darwin
endif

# Default target
.PHONY: all
all: build

# Build the binary
.PHONY: build
build:
	@echo "Building $(BINARY_NAME) for $(OS)/$(ARCH)..."
	$(GO_BUILD) -o $(BINARY_NAME) .
	@echo "Built $(BINARY_NAME) successfully"

# Build with output directory
.PHONY: build-dir
build-dir:
	@mkdir -p $(BUILD_DIR)
	@echo "Building $(BINARY_NAME) for $(OS)/$(ARCH)..."
	$(GO_BUILD) -o $(BUILD_DIR)/$(BINARY_NAME) .
	@echo "Built $(BUILD_DIR)/$(BINARY_NAME) successfully"

# Install binary to system
.PHONY: install
install: build
	@echo "Installing $(BINARY_NAME) to $(BINDIR)..."
	@mkdir -p $(BINDIR)
	@install -m 755 $(BINARY_NAME) $(BINDIR)/$(BINARY_NAME)
	@echo "Installed $(BINARY_NAME) to $(BINDIR)"

# Uninstall binary from system
.PHONY: uninstall
uninstall:
	@echo "Removing $(BINARY_NAME) from $(BINDIR)..."
	@rm -f $(BINDIR)/$(BINARY_NAME)
	@echo "Removed $(BINARY_NAME) from $(BINDIR)"

# Clean build artifacts
.PHONY: clean
clean:
	@echo "Cleaning build artifacts..."
	@rm -f $(BINARY_NAME)
	@rm -rf $(BUILD_DIR)
	@echo "Clean completed"

# Run tests
.PHONY: test
test:
	@echo "Running tests..."
	go test ./...

# Run tests with verbose output
.PHONY: test-verbose
test-verbose:
	@echo "Running tests with verbose output..."
	go test -v ./...

# Run static analysis
.PHONY: vet
vet:
	@echo "Running go vet..."
	go vet ./...

# Format code
.PHONY: fmt
fmt:
	@echo "Formatting code..."
	go fmt ./...

# Run integration tests
.PHONY: test-integration
test-integration:
	@echo "Running integration tests..."
	@if [ -f ./test.sh ]; then \
		chmod +x ./test.sh && ./test.sh; \
	else \
		echo "No integration test script found"; \
	fi

# Development build with debug info
.PHONY: dev
dev:
	@echo "Building $(BINARY_NAME) for development..."
	go build -o $(BINARY_NAME) .
	@echo "Built $(BINARY_NAME) for development"

# Release build (optimized) - enables CGO for SQLite support
.PHONY: release
release:
	@echo "Building $(BINARY_NAME) for release ($(OS)/$(ARCH)) with CGO..."
	CGO_ENABLED=1 GOOS=$(OS) GOARCH=$(ARCH) $(GO_BUILD) -o $(BUILD_DIR)/$(BINARY_NAME)-$(OS)-$(ARCH) .
	@echo "Built $(BUILD_DIR)/$(BINARY_NAME)-$(OS)-$(ARCH) for release"

# Cross-compile for multiple platforms - only for current platform due to CGO requirement
.PHONY: release-all
release-all:
	@echo "Building releases for current platform ($(OS)/$(ARCH)) with CGO..."
	@mkdir -p $(BUILD_DIR)
	@echo "Building for $(OS)/$(ARCH)..."
	CGO_ENABLED=1 GOOS=$(OS) GOARCH=$(ARCH) $(GO_BUILD) -o $(BUILD_DIR)/$(BINARY_NAME)-$(OS)-$(ARCH) .
	@echo "Built $(BUILD_DIR)/$(BINARY_NAME)-$(OS)-$(ARCH) for release"
	@echo "Note: Cross-compilation disabled due to SQLite CGO requirement"
	@echo "To build for other platforms, run 'make release' on those platforms"

# Static release build without CGO (SQLite disabled)
.PHONY: release-static
release-static:
	@echo "Building $(BINARY_NAME) for static release ($(OS)/$(ARCH)) without CGO..."
	CGO_ENABLED=0 GOOS=$(OS) GOARCH=$(ARCH) $(GO_BUILD) -o $(BUILD_DIR)/$(BINARY_NAME)-$(OS)-$(ARCH)-static .
	@echo "Built $(BUILD_DIR)/$(BINARY_NAME)-$(OS)-$(ARCH)-static for static release"
	@echo "Warning: SQLite will not work in static build - use only for testing"

# Show help
.PHONY: help
help:
	@echo "Nospeak Makefile"
	@echo ""
	@echo "Available targets:"
	@echo "  build          - Build the binary for current platform"
	@echo "  build-dir      - Build to build directory"
	@echo "  install        - Build and install to $(BINDIR)"
	@echo "  uninstall      - Remove from $(BINDIR)"
	@echo "  clean          - Remove build artifacts"
	@echo "  test           - Run unit tests"
	@echo "  test-verbose   - Run tests with verbose output"
	@echo "  test-integration - Run integration tests"
	@echo "  vet            - Run go vet static analysis"
	@echo "  fmt            - Format Go code"
	@echo "  dev            - Build for development (with debug info)"
	@echo "  release        - Build optimized release with CGO (SQLite enabled)"
	@echo "  release-all    - Build for current platform (CGO required for SQLite)"
	@echo "  release-static - Build static binary without CGO (SQLite disabled)"
	@echo "  help           - Show this help message"
	@echo ""
	@echo "Variables:"
	@echo "  PREFIX         - Installation prefix (default: $(PREFIX))"
	@echo "  BINDIR         - Binary installation directory (default: $(BINDIR))"
	@echo ""
	@echo "Examples:"
	@echo "  make install                    # Build and install to /usr/local/bin"
	@echo "  make PREFIX=~/.local install    # Install to ~/.local/bin"
	@echo "  make release                    # Build optimized binary with SQLite"
	@echo "  make release-static             # Build static binary without SQLite"