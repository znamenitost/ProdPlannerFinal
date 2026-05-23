# Load testing (k6)

Branch **codexOpt10** — API, DB and frontend under **20 virtual employees**.

## Install

```bash
chmod +x loadtests/install-k6.sh loadtests/run.sh
./loadtests/install-k6.sh
```

## Run backend

```bash
dotnet run --project ProductionPlanner.csproj
```

## Run tests

```bash
./loadtests/run.sh                    # full-stack (~5 min)
./loadtests/run.sh api-employees      # API + DB only
./loadtests/run.sh frontend-static    # SPA static files

K6_BASE_URL=http://localhost:5234 ./loadtests/run.sh
```

Smoke (30s, 5 users):

```bash
k6 run --vus 5 --duration 30s loadtests/scenarios/api-employees.js
```

## Scenarios

| File | Load |
|------|------|
| api-employees | 20 VU: login, active, calendar, table, notifications |
| frontend-static | up to 20 VU: index.html + JS bundle |
| full-stack | both in parallel |

Employees: Dima, Yaromir, Pavel + Test-01..Test-17 (auto-created on first login).

## Remote

```bash
K6_BASE_URL=https://your-host ./loadtests/run.sh api-employees
```

Do not run against production without approval.
