#!/usr/bin/env bash

set -e

# Color output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Default options
VERSION_TYPE="patch"
CUSTOM_VERSION=""
CUSTOM_VERSION_SET=false
DRY_RUN=false
SKIP_GIT=false
SKIP_PUBLISH=false
BETA_RELEASE=false
EXPLICIT_BUMP=false

# Display help
print_help() {
    echo "usage: release.sh [options]"
    echo ""
    echo "Options:"
    echo "  --major          Bump major version (1.0.0 -> 2.0.0)"
    echo "  --minor          Bump minor version (1.0.0 -> 1.1.0)"
    echo "  --patch          Bump patch version (1.0.0 -> 1.0.1) [default]"
    echo "  --beta           Create or increment beta prerelease versions (x.y.z-beta.n)"
    echo "  --version <ver>  Set specific version"
    echo "  --dry-run        Show what would be done without executing"
    echo "  --skip-git       Skip git commit and tag"
    echo "  --skip-publish   Skip npm publish"
    echo "  -h, --help       Show this help"
    echo ""
    echo "Examples:"
    echo "  ./scripts/release.sh              # Patch bump, commit, tag, and publish"
    echo "  ./scripts/release.sh --minor      # Minor bump, commit, tag, and publish"
    echo "  ./scripts/release.sh --beta       # Beta prerelease publish to npm beta dist-tag"
    echo "  ./scripts/release.sh --beta --minor # Minor bump prerelease as x.y.z-beta.0"
    echo "  ./scripts/release.sh --dry-run    # Preview without making changes"
    echo "  ./scripts/release.sh --skip-git   # Bump and publish without git operations"
}

# Parse arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --major)
                VERSION_TYPE="major"
                EXPLICIT_BUMP=true
                shift
                ;;
            --minor)
                VERSION_TYPE="minor"
                EXPLICIT_BUMP=true
                shift
                ;;
            --patch)
                VERSION_TYPE="patch"
                EXPLICIT_BUMP=true
                shift
                ;;
            --beta)
                BETA_RELEASE=true
                shift
                ;;
            --version)
                if [[ $# -lt 2 || "$2" == --* ]]; then
                    echo -e "${RED}Error: --version requires a value${NC}"
                    exit 1
                fi
                CUSTOM_VERSION="$2"
                CUSTOM_VERSION_SET=true
                shift 2
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --skip-git)
                SKIP_GIT=true
                shift
                ;;
            --skip-publish)
                SKIP_PUBLISH=true
                shift
                ;;
            -h|--help)
                print_help
                exit 0
                ;;
            *)
                echo -e "${RED}Unknown option: $1${NC}"
                print_help
                exit 1
                ;;
        esac
    done
}

# Validate stable semver format
validate_stable_version() {
    local version="$1"
    if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        echo -e "${RED}Invalid version format: $version${NC}"
        exit 1
    fi
}

# Validate supported project version format (stable or beta prerelease)
validate_supported_version() {
    local version="$1"
    if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-beta\.[0-9]+)?$ ]]; then
        echo -e "${RED}Unsupported package.json version format: $version${NC}"
        echo -e "${YELLOW}Supported formats: x.y.z or x.y.z-beta.n${NC}"
        exit 1
    fi
}

# Extract base version from stable/beta version
extract_base_version() {
    local version="$1"
    if [[ "$version" =~ ^([0-9]+\.[0-9]+\.[0-9]+)(-beta\.[0-9]+)?$ ]]; then
        echo "${BASH_REMATCH[1]}"
        return
    fi

    echo -e "${RED}Failed to extract base version from: $version${NC}"
    exit 1
}

# Check if version is a beta prerelease
is_beta_version() {
    local version="$1"
    [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+-beta\.[0-9]+$ ]]
}

# Extract numeric beta counter from version
extract_beta_number() {
    local version="$1"
    if [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+-beta\.([0-9]+)$ ]]; then
        echo "${BASH_REMATCH[1]}"
        return
    fi

    echo -e "${RED}Failed to extract beta number from: $version${NC}"
    exit 1
}

# Bump version
bump_version() {
    local current="$1"
    local type="$2"

    IFS='.' read -r major minor patch <<< "$current"

    case "$type" in
        major)
            major=$((major + 1))
            minor=0
            patch=0
            ;;
        minor)
            minor=$((minor + 1))
            patch=0
            ;;
        patch)
            patch=$((patch + 1))
            ;;
    esac

    echo "${major}.${minor}.${patch}"
}

# Get current version
get_current_version() {
    grep '"version"' package.json | head -1 | sed 's/.*: "\(.*\)".*/\1/'
}

# Update package.json version
update_version() {
    local new_version="$1"
    local dry_run="$2"

    if [[ "$dry_run" == true ]]; then
        echo -e "${YELLOW}[DRY RUN] Would update package.json to version $new_version${NC}"
        return
    fi

    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s/\"version\": \".*\"/\"version\": \"$new_version\"/" package.json
    else
        # Linux
        sed -i "s/\"version\": \".*\"/\"version\": \"$new_version\"/" package.json
    fi

    echo -e "${GREEN}✓ Updated package.json to version $new_version${NC}"
}

# Run command
run_cmd() {
    local cmd="$1"
    local description="$2"
    local dry_run="$3"

    if [[ "$dry_run" == true ]]; then
        echo -e "${YELLOW}[DRY RUN] Would $description: $cmd${NC}"
        return
    fi

    echo -e "${GREEN}Running: $description${NC}"
    if eval "$cmd"; then
        echo -e "${GREEN}✓ $description${NC}"
    else
        echo -e "${RED}✗ Failed: $description${NC}"
        exit 1
    fi
}

# Check git status
check_git_status() {
    if ! git diff --quiet; then
        echo -e "${RED}Error: Working directory is not clean. Please commit or stash changes first.${NC}"
        exit 1
    fi

    if ! git diff --cached --quiet; then
        echo -e "${RED}Error: Staged changes exist. Please commit or reset them first.${NC}"
        exit 1
    fi
}

# Check npm authentication
check_npm_auth() {
    if ! npm whoami &>/dev/null; then
        echo -e "${RED}Error: Not authenticated to npm registry.${NC}"
        echo -e "${YELLOW}Please login first with: npm login${NC}"
        exit 1
    fi
}

# Main script
main() {
    parse_args "$@"

    if [[ "$BETA_RELEASE" == true && "$CUSTOM_VERSION_SET" == true ]]; then
        echo -e "${RED}Error: --beta cannot be combined with --version.${NC}"
        exit 1
    fi

    if [[ "$CUSTOM_VERSION_SET" == true && "$EXPLICIT_BUMP" == true ]]; then
        echo -e "${RED}Error: --version cannot be combined with --major, --minor, or --patch.${NC}"
        exit 1
    fi

    echo -e "${GREEN}🚀 Starting release process...${NC}"
    echo ""

    # Check git status before modifying any files
    if [[ "$SKIP_GIT" == false && "$DRY_RUN" == false ]]; then
        check_git_status
    fi

    # Validate npm authentication before performing release steps
    if [[ "$SKIP_PUBLISH" == false && "$DRY_RUN" == false ]]; then
        check_npm_auth
    fi

    # Get current version
    CURRENT_VERSION=$(get_current_version)
    validate_supported_version "$CURRENT_VERSION"
    echo "Current version: $CURRENT_VERSION"

    # Calculate new version
    if [[ "$CUSTOM_VERSION_SET" == true ]]; then
        validate_stable_version "$CUSTOM_VERSION"
        NEW_VERSION="$CUSTOM_VERSION"
    elif [[ "$BETA_RELEASE" == true ]]; then
        BASE_VERSION=$(extract_base_version "$CURRENT_VERSION")

        if [[ "$EXPLICIT_BUMP" == true ]]; then
            BUMPED_BASE_VERSION=$(bump_version "$BASE_VERSION" "$VERSION_TYPE")
            NEW_VERSION="${BUMPED_BASE_VERSION}-beta.0"
        elif is_beta_version "$CURRENT_VERSION"; then
            CURRENT_BETA_NUMBER=$(extract_beta_number "$CURRENT_VERSION")
            NEXT_BETA_NUMBER=$((CURRENT_BETA_NUMBER + 1))
            NEW_VERSION="${BASE_VERSION}-beta.${NEXT_BETA_NUMBER}"
        else
            BUMPED_BASE_VERSION=$(bump_version "$BASE_VERSION" "patch")
            NEW_VERSION="${BUMPED_BASE_VERSION}-beta.0"
        fi
    else
        BASE_VERSION=$(extract_base_version "$CURRENT_VERSION")
        if [[ "$EXPLICIT_BUMP" == true ]]; then
            NEW_VERSION=$(bump_version "$BASE_VERSION" "$VERSION_TYPE")
        else
            NEW_VERSION=$(bump_version "$BASE_VERSION" "patch")
        fi
    fi

    echo "New version: $NEW_VERSION"
    echo ""

    # Update version in package.json
    update_version "$NEW_VERSION" "$DRY_RUN"

    # Build the project
    run_cmd "npm run build" "Build project" "$DRY_RUN"

    # Run tests
    run_cmd "npm test" "Run tests" "$DRY_RUN"

    # Run type checking
    run_cmd "npm run typecheck" "Run type checking" "$DRY_RUN"

    # Git operations
    if [[ "$SKIP_GIT" == false ]]; then
        COMMIT_MSG="chore: release v${NEW_VERSION}"
        run_cmd "git add package.json" "Stage package.json" "$DRY_RUN"
        run_cmd "git commit -m \"$COMMIT_MSG\"" "Commit changes" "$DRY_RUN"
        run_cmd "git tag -a v${NEW_VERSION} -m \"Release v${NEW_VERSION}\"" "Create tag v${NEW_VERSION}" "$DRY_RUN"
    fi

    # Publish to npm
    if [[ "$SKIP_PUBLISH" == false ]]; then
        if [[ "$BETA_RELEASE" == true ]]; then
            run_cmd "npm publish --tag beta" "Publish beta to npm" "$DRY_RUN"
        else
            run_cmd "npm publish" "Publish to npm" "$DRY_RUN"
        fi
    fi

    # Push to git
    if [[ "$SKIP_GIT" == false ]]; then
        run_cmd "git push" "Push commit to remote" "$DRY_RUN"
        run_cmd "git push --tags" "Push tags to remote" "$DRY_RUN"
    fi

    echo ""
    echo -e "${GREEN}✅ Release completed successfully!${NC}"
    if [[ "$DRY_RUN" == true ]]; then
        echo -e "${YELLOW}(This was a dry run - no actual changes were made)${NC}"
    fi
}

main "$@"
