import { NextRequest } from "next/server";
import { getClient } from "@/lib/xrpl/client";
import { resolveNetwork } from "@/lib/xrpl/networks";
import { decodeCredentialType } from "@/lib/xrpl/credentials";
import { apiErrorResponse } from "@/lib/api";
import type { CredentialInfo } from "@/lib/types";

const ACCEPTED_FLAG = 0x00010000; // lsfAccepted = 65536

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  try {
    const { address } = await params;
    const sp = request.nextUrl.searchParams;
    const network = sp.get("network") ?? undefined;
    const role = sp.get("role") ?? undefined; // "issuer" | "subject" | undefined

    const client = await getClient(resolveNetwork(network));

    const response = await client.request({
      command: "account_objects",
      account: address,
      type: "credential",
    });

    const objects = response.result.account_objects as Array<{
      Issuer: string;
      Subject: string;
      CredentialType: string;
      Flags: number;
      Expiration?: number;
      URI?: string;
    }>;

    let credentials: CredentialInfo[] = objects.map((obj) => {
      const info: CredentialInfo = {
        issuer: obj.Issuer,
        subject: obj.Subject,
        credentialType: decodeCredentialType(obj.CredentialType),
        accepted: (obj.Flags & ACCEPTED_FLAG) !== 0,
      };
      if (obj.Expiration !== undefined) {
        info.expiration = obj.Expiration;
      }
      if (obj.URI) {
        info.uri = Buffer.from(obj.URI, "hex").toString("utf-8");
      }
      return info;
    });

    if (role === "issuer") {
      credentials = credentials.filter((c) => c.issuer === address);
    } else if (role === "subject") {
      credentials = credentials.filter((c) => c.subject === address);
    }

    return Response.json({ address, credentials });
  } catch (err) {
    return apiErrorResponse(err, "Failed to fetch credentials", { checkNotFound: true });
  }
}
