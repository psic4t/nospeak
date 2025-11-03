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

# Release build (optimized) - now uses pure Go SQLite
.PHONY: release
release:
	@echo "Building $(BINARY_NAME) for release ($(OS)/$(ARCH))..."
	@mkdir -p $(BUILD_DIR)
	CGO_ENABLED=0 GOOS=$(OS) GOARCH=$(ARCH) $(GO_BUILD) -o $(BUILD_DIR)/$(BINARY_NAME)-$(OS)-$(ARCH) .
	@echo "Built $(BUILD_DIR)/$(BINARY_NAME)-$(OS)-$(ARCH) for release"
	@echo "Copying necessary files..."
	@mkdir -p $(BUILD_DIR)/config
	@cp config/example.toml $(BUILD_DIR)/config/
	@cp README.md $(BUILD_DIR)/
	@cp LICENSE $(BUILD_DIR)/
	@echo "Release package created in $(BUILD_DIR)/"

# Cross-compile for multiple platforms - now supports full cross-compilation
.PHONY: release-all
release-all:
	@echo "Building releases for all platforms..."
	@mkdir -p $(BUILD_DIR)
	@echo "Building for linux/amd64..."
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 $(GO_BUILD) -o $(BUILD_DIR)/$(BINARY_NAME)-linux-amd64 .
	@echo "Building for linux/arm64..."
	CGO_ENABLED=0 GOOS=linux GOARCH=arm64 $(GO_BUILD) -o $(BUILD_DIR)/$(BINARY_NAME)-linux-arm64 .
	@echo "Building for darwin/amd64..."
	CGO_ENABLED=0 GOOS=darwin GOARCH=amd64 $(GO_BUILD) -o $(BUILD_DIR)/$(BINARY_NAME)-darwin-amd64 .
	@echo "Building for darwin/arm64..."
	CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 $(GO_BUILD) -o $(BUILD_DIR)/$(BINARY_NAME)-darwin-arm64 .
	@echo "Building for windows/amd64..."
	CGO_ENABLED=0 GOOS=windows GOARCH=amd64 $(GO_BUILD) -o $(BUILD_DIR)/$(BINARY_NAME)-windows-amd64.exe .
	@echo "Copying necessary files..."
	@mkdir -p $(BUILD_DIR)/config
	@cp config/example.toml $(BUILD_DIR)/config/
	@cp README.md $(BUILD_DIR)/
	@cp LICENSE $(BUILD_DIR)/
	@echo "All release packages created in $(BUILD_DIR)/"

# Note: All builds are now static since we use pure Go SQLite
.PHONY: release-static
release-static: release

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
	@echo "  release        - Build optimized release with pure Go SQLite and copy necessary files"
	@echo "  release-all    - Build releases for all platforms (Linux, macOS, Windows) and copy necessary files"
	@echo "  release-static - Same as release (all builds are now static)"
	@echo "  help           - Show this help message"
	@echo ""
	@echo "Variables:"
	@echo "  PREFIX         - Installation prefix (default: $(PREFIX))"
	@echo "  BINDIR         - Binary installation directory (default: $(BINDIR))"
	@echo ""
	@echo "Examples:"
	@echo "  make install                    # Build and install to /usr/local/bin"
	@echo "  make PREFIX=~/.local install    # Install to ~/.local/bin"
	@echo "  make release                    # Build optimized binary with pure Go SQLite"
	@echo "  make release-all                # Build releases for all platforms"
	@echo "  make release-static             # Same as release (all builds are now static)"