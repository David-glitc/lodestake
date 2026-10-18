#!/usr/bin/env python3
"""Publish the built BOT Chain sites with a one-hour Workers-only token, then revoke it."""
from pathlib import Path
import datetime, json, os, re, subprocess, sys, tempfile, time

ROOT = Path(__file__).resolve().parent.parent

def credentials():
    values = {}
    for line in Path(os.environ.get('CF_CREDENTIALS_FILE',str(Path.home()/'cf.creds'))).read_text().splitlines():
        match = re.match(r'^\s*(?:export\s+)?([\w]+)\s*=\s*(.*?)\s*$',line)
        if match: values[match[1]] = match[2].strip('"\'')
    account = values.get('CLOUDFLARE_ACCOUNT_ID') or values.get('VPS_ACCOUNT_ID') or values.get('VPS_ACOUNT_ID')
    parent = values.get('API_MANAGEMENT')
    if not account or not parent: raise SystemExit('The authorized credentials file needs an account ID and API_MANAGEMENT.')
    return account,parent

def main():
    account,parent = credentials()
    base = os.environ | {'CLOUDFLARE_ACCOUNT_ID':account,'NODE_OPTIONS':'--dns-result-order=ipv4first','NO_COLOR':'1'}
    parent_env = base | {'CLOUDFLARE_API_TOKEN':parent}
    secrets = [parent]
    def redact(text):
        for secret in secrets: text = text.replace(secret,'[redacted]')
        return text
    def run(args,env,check=True):
        result = subprocess.run(args,cwd=ROOT,env=env,capture_output=True,text=True)
        if check and result.returncode: raise RuntimeError(redact(result.stdout+result.stderr))
        return result
    token = None
    try:
        with tempfile.TemporaryDirectory(prefix='botchain-token-') as temp:
            # Workers Scripts Write only, on this account only.
            policies = [{'effect':'allow','resources':{'com.cloudflare.api.account.'+account:'*'},'permission_groups':[{'id':'e086da7e2179491d91ee5f35b3ca210a'}]}]
            file = Path(temp)/'policies.json';file.write_text(json.dumps(policies));file.chmod(0o600)
            expires = (datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(hours=1)).strftime('%Y-%m-%dT%H:%M:%SZ')
            value = json.loads(run(['cf','user','tokens','create','--name','botchain-wave1-deploy','--expires-on',expires,'--policies','@'+str(file)],parent_env).stdout)
            token = value.get('result',value)
        secrets.append(token['value'])
        time.sleep(3)  # New tokens can take a moment to propagate.
        result = run(['node','scripts/deploy-sites.mjs',*sys.argv[1:]],base | {'CLOUDFLARE_API_TOKEN':token['value'],'CF_CREDENTIALS_FILE':'/dev/null'},check=False)
        print(redact(result.stdout)); print(redact(result.stderr),file=sys.stderr)
        if result.returncode: raise SystemExit(result.returncode)
    finally:
        if token:
            revoked = run(['cf','user','tokens','delete',token['id'],'--force'],parent_env,check=False).returncode == 0
            print('Temporary token revoked.' if revoked else 'Token revocation failed; it expires within one hour.',file=sys.stderr)

if __name__ == '__main__': main()
