#!/usr/bin/env pwsh

$ErrorActionPreference = "Stop"

# Color output
$GREEN = "Green"
$YELLOW = "Yellow"
$RED = "Red"

# Default options
$VersionType = "patch"
$CustomVersion = ""
$DryRun = $false
$SkipGit = $false
$SkipPublish = $false

function Write-Color {
    param(
        [Parameter(Mandatory = $true)][string]$Message,
        [Parameter(Mandatory = $true)][string]$Color
    )
    Write-Host $Message -ForegroundColor $Color
}

function Print-Help {
    Write-Host "usage: release.ps1 [options]"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  --major          Bump major version (1.0.0 -> 2.0.0)"
    Write-Host "  --minor          Bump minor version (1.0.0 -> 1.1.0)"
    Write-Host "  --patch          Bump patch version (1.0.0 -> 1.0.1) [default]"
    Write-Host "  --version <ver>  Set specific version"
    Write-Host "  --dry-run        Show what would be done without executing"
    Write-Host "  --skip-git       Skip git commit and tag"
    Write-Host "  --skip-publish   Skip npm publish"
    Write-Host "  -h, --help       Show this help"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  ./scripts/release.ps1              # Patch bump, commit, tag, and publish"
    Write-Host "  ./scripts/release.ps1 --minor      # Minor bump, commit, tag, and publish"
    Write-Host "  ./scripts/release.ps1 --dry-run    # Preview without making changes"
    Write-Host "  ./scripts/release.ps1 --skip-git   # Bump and publish without git operations"
}

function Parse-Args {
    param([string[]]$ArgsList)

    $i = 0
    while ($i -lt $ArgsList.Count) {
        switch ($ArgsList[$i]) {
            "--major" {
                $script:VersionType = "major"
                $i++
            }
            "--minor" {
                $script:VersionType = "minor"
                $i++
            }
            "--patch" {
                $script:VersionType = "patch"
                $i++
            }
            "--version" {
                if ($i + 1 -ge $ArgsList.Count) {
                    Write-Color "Error: --version requires a value" $RED
                    exit 1
                }
                $script:VersionType = "custom"
                $script:CustomVersion = $ArgsList[$i + 1]
                $i += 2
            }
            "--dry-run" {
                $script:DryRun = $true
                $i++
            }
            "--skip-git" {
                $script:SkipGit = $true
                $i++
            }
            "--skip-publish" {
                $script:SkipPublish = $true
                $i++
            }
            "--help" {
                Print-Help
                exit 0
            }
            "-h" {
                Print-Help
                exit 0
            }
            default {
                Write-Color "Unknown option: $($ArgsList[$i])" $RED
                Print-Help
                exit 1
            }
        }
    }
}

function Validate-Version {
    param([Parameter(Mandatory = $true)][string]$Version)
    if ($Version -notmatch '^\d+\.\d+\.\d+$') {
        Write-Color "Invalid version format: $Version" $RED
        exit 1
    }
}

function Bump-Version {
    param(
        [Parameter(Mandatory = $true)][string]$Current,
        [Parameter(Mandatory = $true)][string]$Type
    )

    [int]$major, [int]$minor, [int]$patch = $Current.Split(".")

    switch ($Type) {
        "major" {
            $major += 1
            $minor = 0
            $patch = 0
        }
        "minor" {
            $minor += 1
            $patch = 0
        }
        "patch" {
            $patch += 1
        }
    }

    return "$major.$minor.$patch"
}

function Get-CurrentVersion {
    $package = Get-Content -Raw "package.json" | ConvertFrom-Json
    return $package.version
}

function Update-Version {
    param(
        [Parameter(Mandatory = $true)][string]$NewVersion,
        [Parameter(Mandatory = $true)][bool]$IsDryRun
    )

    if ($IsDryRun) {
        Write-Color "[DRY RUN] Would update package.json to version $NewVersion" $YELLOW
        return
    }

    $content = Get-Content -Raw "package.json"
    $updated = $content -replace '"version"\s*:\s*".*?"', "`"version`": `"$NewVersion`""
    $packagePath = (Resolve-Path "package.json").Path
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($packagePath, $updated, $utf8NoBom)
    Write-Color "OK Updated package.json to version $NewVersion" $GREEN
}

function Run-Cmd {
    param(
        [Parameter(Mandatory = $true)][string]$Command,
        [Parameter(Mandatory = $true)][string]$Description,
        [Parameter(Mandatory = $true)][bool]$IsDryRun
    )

    if ($IsDryRun) {
        Write-Color "[DRY RUN] Would $Description`: $Command" $YELLOW
        return
    }

    Write-Color "Running: $Description" $GREEN
    Invoke-Expression $Command
    if ($LASTEXITCODE -eq 0) {
        Write-Color "OK $Description" $GREEN
    } else {
        Write-Color "Failed: $Description" $RED
        exit 1
    }
}

function Check-GitStatus {
    git diff --quiet
    if ($LASTEXITCODE -ne 0) {
        Write-Color "Error: Working directory is not clean. Please commit or stash changes first." $RED
        exit 1
    }

    git diff --cached --quiet
    if ($LASTEXITCODE -ne 0) {
        Write-Color "Error: Staged changes exist. Please commit or reset them first." $RED
        exit 1
    }
}

function Check-NpmAuth {
    npm whoami *> $null
    if ($LASTEXITCODE -ne 0) {
        Write-Color "Error: Not authenticated to npm registry." $RED
        Write-Color "Please login first with: npm login" $YELLOW
        exit 1
    }
}

function Main {
    param([string[]]$CliArgs)

    Parse-Args -ArgsList $CliArgs

    Write-Color "Starting release process..." $GREEN
    Write-Host ""

    if (-not $SkipGit -and -not $DryRun) {
        Check-GitStatus
    }

    $currentVersion = Get-CurrentVersion
    Write-Host "Current version: $currentVersion"

    if ($VersionType -eq "custom") {
        if ([string]::IsNullOrWhiteSpace($CustomVersion)) {
            Write-Color "Error: Custom version requires --version <ver> argument" $RED
            exit 1
        }
        Validate-Version -Version $CustomVersion
        $newVersion = $CustomVersion
    } else {
        $newVersion = Bump-Version -Current $currentVersion -Type $VersionType
    }

    Write-Host "New version: $newVersion"
    Write-Host ""

    Update-Version -NewVersion $newVersion -IsDryRun $DryRun
    Run-Cmd -Command "bun run build" -Description "Build project" -IsDryRun $DryRun
    Run-Cmd -Command "bun test" -Description "Run tests" -IsDryRun $DryRun
    Run-Cmd -Command "bun x tsc --noEmit" -Description "Run type checking" -IsDryRun $DryRun

    if (-not $SkipGit) {
        $commitMsg = "chore: release v$newVersion"
        Run-Cmd -Command "git add package.json" -Description "Stage package.json" -IsDryRun $DryRun
        Run-Cmd -Command "git commit -m `"$commitMsg`"" -Description "Commit changes" -IsDryRun $DryRun
        Run-Cmd -Command "git tag -a v$newVersion -m `"Release v$newVersion`"" -Description "Create tag v$newVersion" -IsDryRun $DryRun
    }

    if (-not $SkipPublish) {
        if (-not $DryRun) {
            Check-NpmAuth
        }
        Run-Cmd -Command "bun publish" -Description "Publish to npm" -IsDryRun $DryRun
    }

    if (-not $SkipGit) {
        Run-Cmd -Command "git push" -Description "Push commit to remote" -IsDryRun $DryRun
        Run-Cmd -Command "git push --tags" -Description "Push tags to remote" -IsDryRun $DryRun
    }

    Write-Host ""
    Write-Color "Release completed successfully!" $GREEN
    if ($DryRun) {
        Write-Color "(This was a dry run - no actual changes were made)" $YELLOW
    }
}

Main -CliArgs $args
