$ErrorActionPreference = "Stop"

New-Item -ItemType Directory -Force -Path (Join-Path $PSScriptRoot "..\\output") | Out-Null

$nodeCommand = (Get-Command node -ErrorAction Stop).Source

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $nodeCommand
$psi.Arguments = "server/index.mjs"
$psi.WorkingDirectory = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$psi.UseShellExecute = $false
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.Environment["NODE_OPTIONS"] = "--max-old-space-size=1024"
$psi.Environment["BANKING_API_PORT"] = "8110"
$psi.Environment["BANKING_JWT_SECRET"] = "test-secret-for-approval-flow"
$psi.Environment["WASI_ALLOW_DEMO_USERS"] = "true"
$psi.Environment["WASI_DEMO_CLIENT_PASSWORD"] = "ClientDemo123"
$psi.Environment["WASI_DEMO_TELLER_PASSWORD"] = "TellerDemo123"
$psi.Environment["WASI_DEMO_MANAGER_PASSWORD"] = "ManagerDemo123"
$psi.Environment["BANKING_APPROVAL_THRESHOLD_CENTIMES"] = "100000000"
$psi.Environment["BANKING_CLIENT_TRANSFER_MAX_CENTIMES"] = "50000000"

$proc = New-Object System.Diagnostics.Process
$proc.StartInfo = $psi
$null = $proc.Start()

Start-Sleep -Seconds 3

try {
  $base = "http://127.0.0.1:8110"
  $tellerLogin = Invoke-RestMethod -Method Post -Uri "$base/api/v1/banking/auth/login" -ContentType "application/json" -Body (@{
    username = "teller_demo"
    password = "TellerDemo123"
  } | ConvertTo-Json -Compress)
  $managerLogin = Invoke-RestMethod -Method Post -Uri "$base/api/v1/banking/auth/login" -ContentType "application/json" -Body (@{
    username = "manager_demo"
    password = "ManagerDemo123"
  } | ConvertTo-Json -Compress)
  $clientLogin = Invoke-RestMethod -Method Post -Uri "$base/api/v1/banking/auth/login" -ContentType "application/json" -Body (@{
    username = "client_demo"
    password = "ClientDemo123"
  } | ConvertTo-Json -Compress)

  $tellerHeaders = @{
    Authorization = "Bearer $($tellerLogin.data.accessToken)"
    "Idempotency-Key" = "approval-test-deposit-1"
  }
  $managerHeaders = @{
    Authorization = "Bearer $($managerLogin.data.accessToken)"
    "Idempotency-Key" = "approval-test-approve-1"
  }
  $clientHeaders = @{
    Authorization = "Bearer $($clientLogin.data.accessToken)"
    "Idempotency-Key" = "approval-test-transfer-limit-1"
  }

  $deposit = Invoke-RestMethod -Method Post -Uri "$base/api/v1/banking/deposit" -Headers $tellerHeaders -ContentType "application/json" -Body (@{
    accountId = "fd43f43e-d0f7-4be3-9769-34bd4eebbc0b"
    amountCentimes = "100000000"
    description = "High value deposit test"
  } | ConvertTo-Json -Compress)

  $approvalId = $deposit.data.approval.id
  $approvals = Invoke-RestMethod -Method Get -Uri "$base/api/v1/banking/approvals?status=PENDING&limit=10" -Headers @{
    Authorization = "Bearer $($managerLogin.data.accessToken)"
  }
  $approved = Invoke-RestMethod -Method Post -Uri "$base/api/v1/banking/approvals/$approvalId/approve" -Headers $managerHeaders -ContentType "application/json" -Body (@{
    decisionNote = "Approved in test"
  } | ConvertTo-Json -Compress)
  $limitRequest = [System.Net.HttpWebRequest]::Create("$base/api/v1/banking/transfer")
  $limitRequest.Method = "POST"
  $limitRequest.ContentType = "application/json"
  $limitRequest.Headers["Authorization"] = "Bearer $($clientLogin.data.accessToken)"
  $limitRequest.Headers["Idempotency-Key"] = "approval-test-transfer-limit-1"
  $limitPayload = (@{
    fromAccountId = "fd43f43e-d0f7-4be3-9769-34bd4eebbc0b"
    toAccountId = "05729563-6d54-4742-9d16-d2f29e5fd2e9"
    amountCentimes = "50000001"
    description = "Transfer above client limit"
  } | ConvertTo-Json -Compress)
  $payloadBytes = [System.Text.Encoding]::UTF8.GetBytes($limitPayload)
  $limitRequest.ContentLength = $payloadBytes.Length
  $requestStream = $limitRequest.GetRequestStream()
  $requestStream.Write($payloadBytes, 0, $payloadBytes.Length)
  $requestStream.Dispose()

  $limitStatusCode = $null
  $limitError = $null
  try {
    $limitResponse = $limitRequest.GetResponse()
    $limitStatusCode = [int]$limitResponse.StatusCode
    $reader = New-Object System.IO.StreamReader($limitResponse.GetResponseStream())
    $limitError = $reader.ReadToEnd()
    $reader.Dispose()
    $limitResponse.Dispose()
  } catch [System.Net.WebException] {
    $response = $_.Exception.Response
    if ($response) {
      $limitStatusCode = [int]$response.StatusCode
      $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
      $limitError = $reader.ReadToEnd()
      $reader.Dispose()
      $response.Dispose()
    } else {
      $limitError = $_.Exception.Message
    }
  }

  [pscustomobject]@{
    depositMessage = $deposit.data.message
    approvalStatusBefore = ($approvals.data.approvals | Where-Object { $_.id -eq $approvalId }).status
    approvalStatusAfter = $approved.data.approval.status
    approvedBy = $approved.data.approval.approvedByUsername
    postedTransactionKind = $approved.data.transaction.kind
    clientTransferLimitStatus = $limitStatusCode
    clientTransferLimitError = $limitError
  } | ConvertTo-Json -Compress
}
finally {
  if (!$proc.HasExited) {
    $proc.Kill()
    $proc.WaitForExit()
  }

  $proc.StandardOutput.ReadToEnd() | Set-Content -Path (Join-Path $PSScriptRoot "..\\output\\approval-server-out.log")
  $proc.StandardError.ReadToEnd() | Set-Content -Path (Join-Path $PSScriptRoot "..\\output\\approval-server-err.log")
}
