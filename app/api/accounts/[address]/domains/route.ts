import { NextRequest } from "next/server";
import { getClient } from "@/lib/xrpl/client";
import { resolveNetwork } from "@/lib/xrpl/networks";
import { decodeCredentialType } from "@/lib/xrpl/credentials";
import { apiErrorResponse } from "@/lib/api";
import type { DomainInfo } from "@/lib/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  try {
    const { address } = await params;
    const sp = request.nextUrl.searchParams;
    const network = sp.get("network") ?? undefined;

    const client = await getClient(resolveNetwork(network));

    const response = await client.request({
      command: "account_objects",
      account: address,
      type: "permissioned_domain",
    });

    const objects = response.result.account_objects as Array<{
      index: string;
      Owner?: string;
      AcceptedCredentials: Array<{
        Credential: { Issuer: string; CredentialType: string };
      }>;
      Sequence: number;
    }>;

    const domains: DomainInfo[] = objects.map((obj) => ({
      domainID: obj.index,
      owner: obj.Owner ?? address,
      acceptedCredentials: obj.AcceptedCredentials.map((ac) => ({
        issuer: ac.Credential.Issuer,
        credentialType: decodeCredentialType(ac.Credential.CredentialType),
      })),
      sequence: obj.Sequence,
    }));

    return Response.json({ address, domains });
  } catch (err) {
    return apiErrorResponse(err, "Failed to fetch domains", { checkNotFound: true });
  }
}
