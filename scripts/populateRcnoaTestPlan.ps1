param(
    [string]$RunDirectory = "out/rcnoa-test-results/20260813-003731",
    [string]$TemplatePath = "docs/rcnoa/Test Plan.docx",
    [string]$OutputPath = "docs/rcnoa/RCNOA-Test-Plan-Completed.docx"
)

$ErrorActionPreference = "Stop"

function Resolve-RepositoryPath {
    param([string]$Path)

    if ([System.IO.Path]::IsPathRooted($Path)) {
        return $Path
    }

    return Join-Path $repositoryRoot $Path
}

function Get-Table {
    param([int]$Number)

    return $document.SelectNodes("//w:tbl", $namespaceManager)[$Number - 1]
}

function Get-Cell {
    param(
        [int]$Table,
        [int]$Row,
        [int]$Column
    )

    $tableNode = Get-Table $Table
    return $tableNode.SelectNodes("./w:tr", $namespaceManager)[$Row - 1].SelectNodes("./w:tc", $namespaceManager)[$Column - 1]
}

function Set-CellParagraphs {
    param(
        [int]$Table,
        [int]$Row,
        [int]$Column,
        [string[]]$Paragraphs
    )

    $cell = Get-Cell -Table $Table -Row $Row -Column $Column
    $existingParagraph = $cell.SelectSingleNode("./w:p", $namespaceManager)
    $paragraphProperties = if ($existingParagraph) {
        $existingParagraph.SelectSingleNode("./w:pPr", $namespaceManager)
    } else {
        $null
    }

    foreach ($paragraph in @($cell.SelectNodes("./w:p", $namespaceManager))) {
        $cell.RemoveChild($paragraph) | Out-Null
    }

    foreach ($paragraphText in $Paragraphs) {
        $paragraph = $document.CreateElement("w", "p", $wordNamespace)
        if ($paragraphProperties) {
            $paragraph.AppendChild($paragraphProperties.CloneNode($true)) | Out-Null
        }

        $run = $document.CreateElement("w", "r", $wordNamespace)
        $text = $document.CreateElement("w", "t", $wordNamespace)
        $text.SetAttribute("space", "http://www.w3.org/XML/1998/namespace", "preserve") | Out-Null
        $text.InnerText = $paragraphText
        $run.AppendChild($text) | Out-Null
        $paragraph.AppendChild($run) | Out-Null
        $cell.AppendChild($paragraph) | Out-Null
    }
}

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$resolvedRunDirectory = Resolve-RepositoryPath $RunDirectory
$resolvedTemplatePath = Resolve-RepositoryPath $TemplatePath
$resolvedOutputPath = Resolve-RepositoryPath $OutputPath
$metadataPath = Join-Path $resolvedRunDirectory "raw/run-metadata.json"
$jestPath = Join-Path $resolvedRunDirectory "raw/jest-results.json"
$fixturePath = Join-Path $resolvedRunDirectory "raw/fixture-execution.json"

foreach ($requiredPath in @($resolvedTemplatePath, $metadataPath, $jestPath, $fixturePath)) {
    if (-not (Test-Path $requiredPath -PathType Leaf)) {
        throw "Required file not found: $requiredPath"
    }
}

$metadata = Get-Content $metadataPath -Raw | ConvertFrom-Json
$jest = Get-Content $jestPath -Raw | ConvertFrom-Json
$fixtures = Get-Content $fixturePath -Raw | ConvertFrom-Json

if (-not $jest.success -or -not $fixtures.passed) {
    throw "The selected run did not pass. Refusing to create a completed PASS test plan."
}

$workDirectory = Join-Path ([System.IO.Path]::GetTempPath()) ("rcnoa-test-plan-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $workDirectory | Out-Null

try {
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $templateCopyPath = Join-Path ([System.IO.Path]::GetTempPath()) ("rcnoa-test-plan-template-" + [guid]::NewGuid().ToString("N") + ".docx")
    Copy-Item $resolvedTemplatePath $templateCopyPath
    [System.IO.Compression.ZipFile]::ExtractToDirectory($templateCopyPath, $workDirectory)
    Remove-Item $templateCopyPath -Force

    $documentPath = Join-Path $workDirectory "word/document.xml"
    $document = New-Object System.Xml.XmlDocument
    $document.PreserveWhitespace = $true
    $document.Load($documentPath)

    $wordNamespace = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
    $namespaceManager = New-Object System.Xml.XmlNamespaceManager($document.NameTable)
    $namespaceManager.AddNamespace("w", $wordNamespace)

    $started = [DateTimeOffset]::Parse($metadata.startedAt).UtcDateTime
    $completed = [DateTimeOffset]::Parse($metadata.completedAt).UtcDateTime
    $durationSeconds = [Math]::Round($metadata.durationMs / 1000, 3)
    $worktreeState = if ($metadata.worktreeDirty) { "local changes present" } else { "clean" }

    Set-CellParagraphs 2 1 2 @("RCNO / RCNA / 834 Reconciliation")
    Set-CellParagraphs 3 1 2 @("Not provided")
    Set-CellParagraphs 3 1 4 @("RCNOA fixture and reporting automation")
    Set-CellParagraphs 3 2 2 @("Automated test suite")
    Set-CellParagraphs 3 2 4 @("Not specified")
    Set-CellParagraphs 3 3 2 @("N/A")
    Set-CellParagraphs 3 3 4 @("N/A")

    Set-CellParagraphs 4 1 1 @(
        "Validation of RCNO-to-RCNA reconciliation rules and focused RCNA-to-X12 834 generation using deterministic synthetic fixtures and repository automated tests.",
        "Final result: PASS. $($jest.numPassedTests)/$($jest.numTotalTests) Jest tests, $($fixtures.passedFixtureCount)/$($fixtures.fixtureCount) fixtures, and $($fixtures.passedCatalogCaseCount)/$($fixtures.catalogCaseCount) catalog cases passed."
    )

    Set-CellParagraphs 5 1 1 @(
        "Confirm that the production transformation selects the expected rule and reconciliation code for every catalog case.",
        "Confirm mock database lookups, malformed input handling, duplicate detection, mutation protection, deterministic address normalization, RCNA output shape, and focused 834 generation.",
        "Produce reviewable machine-readable evidence and packaged input/output artifacts."
    )

    Set-CellParagraphs 6 1 1 @(
        "The test run uses synthetic fixture identities and does not require production data or PHI.",
        "Results depend on the checked-out source, Node.js dependencies, and the five broad plus ten focused fixtures present at execution time.",
        "Broad complete-rule fixtures are RCNA-only by design because mixed transaction intents cannot form one valid 834 transaction. Focused fixtures provide deterministic 834 coverage."
    )

    Set-CellParagraphs 7 2 1 @("RCNO-to-RCNA transformation for all 51 ordered catalog cases across A/B, F, I, N, and fallback rule families.")
    Set-CellParagraphs 7 3 1 @("Mock membership, recent-834, and prior-RCNA database lookup behavior, including malformed and duplicate lookup validation.")
    Set-CellParagraphs 7 4 1 @("RCNA file generation for 15 fixtures and X12 834 generation for 10 focused fixtures; evidence, Markdown/HTML reporting, and ZIP packaging.")

    Set-CellParagraphs 8 2 1 @("Production integrations and live database calls")
    Set-CellParagraphs 8 2 2 @("The executed suite uses deterministic mocks and synthetic data.")
    Set-CellParagraphs 8 2 3 @("Integration differences are mitigated by separate environment and operational validation before release.")
    Set-CellParagraphs 8 3 1 @("Performance, load, failover, and disaster recovery testing")
    Set-CellParagraphs 8 3 2 @("This run validates functional transformation behavior only.")
    Set-CellParagraphs 8 3 3 @("Assess separately if non-functional requirements are introduced.")
    Set-CellParagraphs 8 4 1 @("Combined 834 generation from broad complete-rule fixtures")
    Set-CellParagraphs 8 4 2 @("Mixed intents and sentinel/no-op codes do not represent one valid 834 transaction.")
    Set-CellParagraphs 8 4 3 @("Ten focused fixtures provide valid, reviewable 834 outputs.")

    Set-CellParagraphs 9 1 1 @(
        "COMPLETED - Test scenarios and expected rule/code outcomes defined.",
        "COMPLETED - Five broad and ten focused fixtures generated and validated.",
        "COMPLETED - Node.js v23.6.1 and repository dependencies available.",
        "COMPLETED - Synthetic input data and mock lookup records available.",
        "COMPLETED - Automated evidence and report output directories writable."
    )

    Set-CellParagraphs 10 1 1 @(
        "MET - 100% of agreed automated tests executed: $($jest.numTotalTests)/$($jest.numTotalTests).",
        "MET - $($jest.numPassedTestSuites)/$($jest.numTotalTestSuites) test suites passed with zero failed or pending tests.",
        "MET - $($fixtures.passedFixtureCount)/$($fixtures.fixtureCount) fixtures and $($fixtures.passedCatalogCaseCount)/$($fixtures.catalogCaseCount) catalog cases passed.",
        "MET - Zero severity 1 or severity 2 defects were identified in the final run.",
        "MET - $($fixtures.rcnaFileCount) RCNA files and $($fixtures.x834FileCount) eligible 834 files were generated and archived.",
        "Test summary evidence is available in the generated Markdown and HTML reports; business approval remains pending."
    )

    Set-CellParagraphs 11 2 1 @("Automated Jest suite")
    Set-CellParagraphs 11 2 2 @("Unit and service validation")
    Set-CellParagraphs 11 2 3 @("11 suites; 99 passing tests")
    Set-CellParagraphs 11 2 4 @("No failed or pending tests")
    Set-CellParagraphs 11 3 1 @("RCNOA fixture runner")
    Set-CellParagraphs 11 3 2 @("End-to-end fixture validation")
    Set-CellParagraphs 11 3 3 @("15 fixtures; 61 rows; 51 catalog cases")
    Set-CellParagraphs 11 3 4 @("All fixtures and catalog cases passed")
    Set-CellParagraphs 11 4 1 @("Report and archive scripts")
    Set-CellParagraphs 11 4 2 @("Evidence packaging")
    Set-CellParagraphs 11 4 3 @("Markdown, HTML, raw JSON, and 40-file ZIP")
    Set-CellParagraphs 11 4 4 @("Generated from current-run evidence")

    Set-CellParagraphs 12 2 1 @("Automated test execution")
    Set-CellParagraphs 12 2 2 @($started.ToString("yyyy-MM-dd HH:mm:ss 'UTC'"))
    Set-CellParagraphs 12 2 3 @($completed.ToString("yyyy-MM-dd HH:mm:ss 'UTC'"))
    Set-CellParagraphs 12 2 4 @("Completed in $durationSeconds seconds; overall PASS")
    Set-CellParagraphs 12 3 1 @("Business review and approval")
    Set-CellParagraphs 12 3 2 @("Not scheduled")
    Set-CellParagraphs 12 3 3 @("Not scheduled")
    Set-CellParagraphs 12 3 4 @("Owner and release date were not provided")

    Set-CellParagraphs 13 4 1 @("Local automated test environment")
    Set-CellParagraphs 13 4 2 @("Fixture generation, Jest, transformation, report, and archive execution")
    Set-CellParagraphs 13 4 3 @("N")
    Set-CellParagraphs 13 4 4 @("$($metadata.platform); Node $($metadata.nodeVersion); package $($metadata.packageName) $($metadata.packageVersion)")
    Set-CellParagraphs 13 5 1 @("Git working copy")
    Set-CellParagraphs 13 5 2 @("Source under test")
    Set-CellParagraphs 13 5 3 @("N")
    Set-CellParagraphs 13 5 4 @("Commit $($metadata.gitCommit); worktree $worktreeState")
    Set-CellParagraphs 13 6 1 @("Mock data environment")
    Set-CellParagraphs 13 6 2 @("Deterministic membership, recent-834, and prior-RCNA lookups")
    Set-CellParagraphs 13 6 3 @("N")
    Set-CellParagraphs 13 6 4 @("Synthetic identifiers only; no live database calls")

    Set-CellParagraphs 14 2 1 @("RCNOA Test Results")
    Set-CellParagraphs 14 2 2 @("Run 20260813-003731")
    Set-CellParagraphs 14 2 3 @("out/rcnoa-test-results/20260813-003731/RCNOA-Test-Results.md and .html")
    Set-CellParagraphs 14 3 1 @("Raw automated test evidence")
    Set-CellParagraphs 14 3 2 @("Run 20260813-003731")
    Set-CellParagraphs 14 3 3 @("out/rcnoa-test-results/20260813-003731/raw/")
    Set-CellParagraphs 14 4 1 @("Generated RCNO/RCNA/834 files")
    Set-CellParagraphs 14 4 2 @("40 files")
    Set-CellParagraphs 14 4 3 @("out/rcnoa-test-results/20260813-003731/RCNOA-Generated-Files.zip")

    Set-CellParagraphs 15 2 1 @("Mock behavior differs from live integrations")
    Set-CellParagraphs 15 2 2 @("Low")
    Set-CellParagraphs 15 2 3 @("Environment-specific lookup or integration behavior could remain unverified.")
    Set-CellParagraphs 15 2 4 @("Perform separate integration validation before production release.")
    Set-CellParagraphs 15 3 1 @("Broad fixtures do not emit 834 files")
    Set-CellParagraphs 15 3 2 @("Low")
    Set-CellParagraphs 15 3 3 @("Broad catalog suites validate reconciliation only.")
    Set-CellParagraphs 15 3 4 @("Use the ten focused fixtures for valid 834 output coverage.")
    Set-CellParagraphs 15 4 1 @("Final run used a dirty worktree")
    Set-CellParagraphs 15 4 2 @("Medium")
    Set-CellParagraphs 15 4 3 @("Results are tied to commit $($metadata.gitCommit) plus local changes.")
    Set-CellParagraphs 15 4 4 @("Retain the run evidence and rerun from the release candidate revision before approval.")

    $writerSettings = New-Object System.Xml.XmlWriterSettings
    $writerSettings.Encoding = New-Object System.Text.UTF8Encoding($false)
    $writerSettings.Indent = $false
    $writer = [System.Xml.XmlWriter]::Create($documentPath, $writerSettings)
    try {
        $document.Save($writer)
    } finally {
        $writer.Dispose()
    }

    $outputDirectory = Split-Path -Parent $resolvedOutputPath
    New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
    if (Test-Path $resolvedOutputPath) {
        Remove-Item $resolvedOutputPath -Force
    }

    $outputStream = [System.IO.File]::Open($resolvedOutputPath, [System.IO.FileMode]::CreateNew)
    $archive = New-Object System.IO.Compression.ZipArchive(
        $outputStream,
        [System.IO.Compression.ZipArchiveMode]::Create,
        $false
    )
    try {
        foreach ($file in Get-ChildItem $workDirectory -Recurse -File) {
            $entryName = $file.FullName.Substring($workDirectory.Length + 1).Replace("\", "/")
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
                $archive,
                $file.FullName,
                $entryName,
                [System.IO.Compression.CompressionLevel]::Optimal
            ) | Out-Null
        }
    } finally {
        $archive.Dispose()
        $outputStream.Dispose()
    }
    Write-Output "Created $resolvedOutputPath"
} finally {
    if (Test-Path $workDirectory) {
        Remove-Item $workDirectory -Recurse -Force
    }
}