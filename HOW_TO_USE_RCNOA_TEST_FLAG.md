# How to Use the RCNOA Local Testing Flag

## Purpose

The RCNOA local testing flag enables two development-only behaviors without changing `configActions` or production configuration:

1. EPDS and MDW connection and query properties can be supplied through `.env.local`.
2. Uploaded RCNO inputs and generated RCNA and 834 outputs are written to the local file system instead of Azure Blob Storage.
3. Prior RCNA decision records are read from and written to local JSON instead of MongoDB.

The feature is enabled only when `RCNOA_LOCAL_TESTING` is exactly `true`, ignoring letter case.

## Configure `.env.local`

Add the following properties to the repository's `.env.local` file:

```dotenv
RCNOA_LOCAL_TESTING=true

RCNOA_LOCAL_EPDS_JDBC_URL=jdbc:oracle:thin:@your-epds-connection
RCNOA_LOCAL_EPDS_USERNAME=your-epds-username
RCNOA_LOCAL_EPDS_PASSWORD=your-epds-password
RCNOA_LOCAL_EPDS_QUERY=your-epds-query

RCNOA_LOCAL_MDW_JDBC_URL=jdbc:oracle:thin:@your-mdw-connection
RCNOA_LOCAL_MDW_USERNAME=your-mdw-username
RCNOA_LOCAL_MDW_PASSWORD=your-mdw-password
RCNOA_LOCAL_MDW_QUERY=your-mdw-query
RCNOA_LOCAL_MDW_SSN_BATCH_SIZE=300

# Optional. Relative paths are resolved from the repository root.
RCNOA_LOCAL_OUTPUT_DIR=rcnoa-local-output
```

Do not commit `.env.local`. It may contain credentials and is already ignored by Git.

## Data Source Overrides

When local testing is enabled, the Oracle service uses the six local-prefixed EPDS and MDW connection properties instead of the corresponding `RCNOA_EPDS_*` and `RCNOA_MDW_*` properties populated by `configActions`.

The local query properties override values loaded from the RCNOA query configuration:

- `RCNOA_LOCAL_EPDS_QUERY`
- `RCNOA_LOCAL_MDW_QUERY`
- `RCNOA_LOCAL_MDW_SSN_BATCH_SIZE`

A blank or omitted local query property falls back to its configured value. Connection properties do not fall back while local testing is enabled; all URL, username, and password values required by the selected data sources must be present.

The MDW query must use the `:ssnsJson` bind variable and must not use `:mrnsJson`.

## Local Output Files

With local testing enabled, generated artifacts whose direction is `output` are written beneath:

```text
<repository>/rcnoa-local-output/rcnoa-processing/...
```

Set `RCNOA_LOCAL_OUTPUT_DIR` to use another directory. An absolute path is accepted; a relative path is resolved from the repository root.

This applies to uploaded RCNO files and generated RCNA and 834 files. The current multipart upload workflow stores input directly on local disk. Legacy direct-to-Azure upload reservations are rejected while local testing is enabled, preventing an accidental Azure Blob write. The application can read a locally generated RCNA file when producing an 834 file, and authenticated downloads continue to work through the existing RCNOA download endpoint.

The default `rcnoa-local-output/` directory is ignored by Git.

## Local Prior RCNA History

Local test runs store prior RCNA decision history in:

```text
<repository>/rcnoa-local-output/prior-rcna-records.json
```

The file follows `RCNOA_LOCAL_OUTPUT_DIR` when that setting is provided. It contains the same privacy-preserving data used by MongoDB: an HMAC member match key, reconciliation cycle, RCNA decision fields, age, and run metadata. It does not contain the raw 73-column member prefix.

Each completed local transformation updates matching records for its reconciliation cycle. Later local runs read this file to reconstruct prior RCNA rows. MongoDB is not accessed by the prior-RCNA load or save functions while local testing is enabled.

## Persistence Boundary

With local testing enabled, RCNO input content, generated RCNA/834 content, and prior-RCNA decision history are not persisted to Azure Blob Storage or MongoDB. RCNOA operational metadata, including run status, artifact descriptors, and failure summaries, continues to use the configured MongoDB repository so the existing queue and UI workflow can operate.

Do not treat this flag as a fully offline mode. Oracle lookups, configuration reads, and MongoDB workflow metadata still use their configured services.

## Run Locally

Restart the development server after changing `.env.local` so Next.js reloads the environment:

```cmd
npm run dev
```

Run the normal RCNOA workflow in the application. Generated RCNA and 834 files will appear in the configured local output directory.

## Disable Local Testing

Remove the flag or set it to `false`:

```dotenv
RCNOA_LOCAL_TESTING=false
```

The application will then use the existing configActions/repository configuration and Azure Blob Storage behavior.

## Focused Tests

Run the tests covering the local data-source overrides and local artifact storage:

```cmd
npx jest app/services/rcnoa/__tests__/rcnoaOracleService.test.js app/services/rcnoa/__tests__/rcnoaBlobService.test.js app/services/rcnoa/__tests__/rcnoaPriorRcnaLocalStore.test.js --runInBand
```

## Reconstruct an RCNO File from RCNA

The detailed design requires outbound RCNA columns 1-73 to be exact copies of the source RCNO columns. A decrypted plaintext RCNA file can therefore be converted back to RCNO record content by removing the appended RCNA decision columns:

```cmd
npm run rcna-to-rcno -- path\to\input-rcna.txt [path\to\output-rcno.txt]
```

The input may contain 76-column outbound RCNA rows or 78-column working RCNA rows. The generated file contains exactly 73 pipe-delimited columns per row, no header or trailer, and CRLF line endings.

When the output path is omitted, the script creates a `.reconstructed.rcno.txt` file beside the input and refuses to overwrite an existing file. The reconstructed filename is intentionally not a canonical OPM transfer filename because the original RCNO transfer date cannot be recovered reliably from the RCNA filename.

The input must be decrypted UTF-8 text. Do not pass encrypted `.pgp` bytes to this command, and do not transmit a reconstructed local test file to OPM.

## Reconstruct an RCNO File from RCNA

An RCNA row preserves the original 73 RCNO columns and appends RCNA decision columns. Reconstruct an RCNO file by removing those appended columns:

```cmd
npm run rcna-to-rcno -- path\to\input.rcna.txt path\to\output.rcno.txt
```

The output path is optional. When omitted, the script writes `<input-name>.reconstructed.rcno.txt` beside the input file. It validates that every input row has the supported 76-column outbound or 78-column working RCNA shape and refuses to overwrite an existing output file.

The original RCNO filename and transfer date cannot always be recovered from an RCNA filename. The reconstructed record content is preserved, with CRLF line endings and a final newline.
