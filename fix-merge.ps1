# Abort the merge non-interactively
git merge --abort
if ($LASTEXITCODE -eq 0) {
    Write-Host "Merge aborted successfully"
} else {
    Write-Host "No merge in progress or error occurred"
}

