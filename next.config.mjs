const nextConfig = {
  reactStrictMode: false,
  onDemandEntries: {
    maxInactiveAge: 60 * 1000,
    pagesBufferLength: 5,
  },
  // Keep runtime-resolved libraries out of the server bundle:
  // - officeparser/pdfjs-dist resolve pdf.worker.mjs via require.resolve()
  // - ssh2/ssh2-sftp-client include non-ESM placeable assets that Turbopack
  //   cannot place into server chunks
  // Externalizing them lets Node load packages from node_modules at runtime.
  serverExternalPackages: ['officeparser', 'pdfjs-dist', 'ssh2', 'ssh2-sftp-client','exceljs-hardened'],
  experimental: {
    authInterrupts: true,
    proxyClientMaxBodySize: '200mb',
  }
};

export default nextConfig;