; AppDock portable lifecycle, based on electron-builder 26.15.3 (MIT).
; A stable per-location runtime path preserves unsigned Windows tray identity.
; Kernel handles lease that runtime across launches, restarts and parent crashes.
!include "common.nsh"
!include "extractAppPackage.nsh"
!include "StrFunc.nsh"
${StrCase}

CRCCheck off
WindowIcon Off
AutoCloseWindow True
RequestExecutionLevel ${REQUEST_EXECUTION_LEVEL}
Var PortableId
Var PortableGate
Var PortableLease
Var AppProcess
Var GateOwned
Var ExitCode

Function .onInit
  StrCpy $PortableGate 0
  StrCpy $PortableLease 0
  StrCpy $AppProcess 0
  StrCpy $GateOwned 0
  StrCpy $ExitCode 1
  SetSilent silent
  !insertmacro check64BitAndSetRegView
FunctionEnd

Function AcquireGate
  System::Call 'kernel32::WaitForSingleObject(p $PortableGate, i -1) i .r0'
  StrCmp $0 0 acquired
  StrCmp $0 128 acquired
  Goto failed
  acquired:
    StrCpy $GateOwned 1
    Return
  failed:
    SetErrorLevel 1
    MessageBox MB_OK|MB_ICONSTOP "AppDockの起動処理を開始できませんでした。"
    Quit
FunctionEnd

Function WaitForApp
  System::Call 'kernel32::WaitForSingleObject(p $AppProcess, i -1) i .r0'
  StrCpy $ExitCode 1
  StrCmp $0 0 0 waitDone
  System::Call 'kernel32::GetExitCodeProcess(p $AppProcess, *i .r1) i .r0'
  StrCmp $0 0 waitDone
  StrCpy $ExitCode $1
  waitDone:
  System::Call 'kernel32::CloseHandle(p $AppProcess) i'
  StrCpy $AppProcess 0
FunctionEnd

Section
  ${StdUtils.GetParameter} $R0 "test-profile" ""
  ${StdUtils.NormalizePath} $R1 "$EXEPATH"
  ${StrCase} $R1 "$TEMP|$R1|$R0" "L"
  ${StdUtils.HashText} $PortableId "SHA2-256" "$R1"
  StrLen $0 $PortableId
  StrCmp $0 64 0 failed
  StrCmp "$TEMP" "" failed
  ; Only this generated child directory can be removed, never TEMP or user data.
  StrCpy $INSTDIR "$TEMP\AppDock.at365-$PortableId"
  System::Call 'kernel32::CreateMutexW(p 0, i 0, w "Global\AppDock.Gate.$PortableId") p .r0'
  StrCpy $PortableGate $0
  StrCmp $PortableGate 0 failed
  Call AcquireGate
  System::Call 'kernel32::SetLastError(i 0)'
  System::Call 'kernel32::CreateMutexW(p 0, i 0, w "Global\AppDock.Runtime.$PortableId") p .r0 ?e'
  Pop $1
  StrCpy $PortableLease $0
  StrCmp $PortableLease 0 failed
  ; ERROR_ALREADY_EXISTS means another launcher or host still leases the files.
  StrCmp $1 183 launch
  ClearErrors
  RMDir /r $INSTDIR
  IfErrors failed
  SetOutPath $INSTDIR

  !ifdef APP_DIR_64
    !ifdef APP_DIR_ARM64
      !ifdef APP_DIR_32
        ${if} ${IsNativeARM64}
          File /r "${APP_DIR_ARM64}\*.*"
        ${elseif} ${RunningX64}
          File /r "${APP_DIR_64}\*.*"
        ${else}
          File /r "${APP_DIR_32}\*.*"
        ${endIf}
      !else
        ${if} ${IsNativeARM64}
          File /r "${APP_DIR_ARM64}\*.*"
        ${else}
          File /r "${APP_DIR_64}\*.*"
        ${endIf}
      !endif
    !else
      !ifdef APP_DIR_32
        ${if} ${RunningX64}
          File /r "${APP_DIR_64}\*.*"
        ${else}
          File /r "${APP_DIR_32}\*.*"
        ${endIf}
      !else
        File /r "${APP_DIR_64}\*.*"
      !endif
    !endif
  !else
    !ifdef APP_DIR_32
      File /r "${APP_DIR_32}\*.*"
    !else
      !insertmacro extractEmbeddedAppPackage
    !endif
  !endif
  IfErrors failed

  launch:
  IfFileExists "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0 failed
  System::Call 'kernel32::SetEnvironmentVariableW(w "PORTABLE_EXECUTABLE_DIR", w "$EXEDIR") i'
  System::Call 'kernel32::SetEnvironmentVariableW(w "PORTABLE_EXECUTABLE_FILE", w "$EXEPATH") i'
  System::Call 'kernel32::SetEnvironmentVariableW(w "PORTABLE_EXECUTABLE_APP_FILENAME", w "${APP_FILENAME}") i'
  ${StdUtils.GetAllParameters} $R0 0
  ${StdUtils.ExecShellWaitEx} $0 $AppProcess "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "open" "$R0"
  StrCmp $0 "ok" 0 failed
  ; StdUtils returns "hProc:<hex>", not a numeric Win32 HANDLE. Validate and
  ; decode it before using System calls or transferring the runtime lease.
  StrCpy $1 $AppProcess 6
  StrCmp $1 "hProc:" 0 failed
  StrCpy $AppProcess $AppProcess "" 6
  StrCpy $AppProcess "0x$AppProcess"
  ; Let the child retain a lease even if its portable launcher is killed.
  System::Call 'kernel32::GetCurrentProcess() p .r0'
  System::Call 'kernel32::DuplicateHandle(p r0, p $PortableLease, p $AppProcess, *p .r1, i 0, i 0, i 2) i .r2'
  StrCmp $2 0 duplicateFailed
  System::Call 'kernel32::ReleaseMutex(p $PortableGate) i .r0'
  StrCpy $GateOwned 0
  Call WaitForApp
  Call AcquireGate
  ; Remove files only after the last launcher AND host have released their lease.
  System::Call 'kernel32::CloseHandle(p $PortableLease) i .r0'
  StrCpy $PortableLease 0
  System::Call 'kernel32::SetLastError(i 0)'
  System::Call 'kernel32::CreateMutexW(p 0, i 0, w "Global\AppDock.Runtime.$PortableId") p .r0 ?e'
  Pop $1
  StrCpy $PortableLease $0
  StrCmp $PortableLease 0 done
  StrCmp $1 183 done
  SetOutPath $EXEDIR
  RMDir /r $INSTDIR
  Goto done

  duplicateFailed:
  System::Call 'kernel32::TerminateProcess(p $AppProcess, i 1) i'
  Call WaitForApp
  failed:
  StrCpy $ExitCode 1
  MessageBox MB_OK|MB_ICONSTOP "AppDockを起動できませんでした。完全に終了してから、もう一度起動してください。"
  done:
  StrCmp $PortableLease 0 +2
    System::Call 'kernel32::CloseHandle(p $PortableLease) i'
  StrCmp $GateOwned 1 0 +2
    System::Call 'kernel32::ReleaseMutex(p $PortableGate) i'
  StrCmp $PortableGate 0 +2
    System::Call 'kernel32::CloseHandle(p $PortableGate) i'
  StrCmp $ExitCode "error" 0 +2
    StrCpy $ExitCode 1
  SetErrorLevel $ExitCode
SectionEnd
