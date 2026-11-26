'use server';

import GraphBuilderWithProvider from "./GraphBuilder";

export default async function Page({ params }) {
  const { teamName } = await params;

  return (<GraphBuilderWithProvider teamName={teamName} />);
}
