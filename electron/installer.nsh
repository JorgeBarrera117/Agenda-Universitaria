!include "FileFunc.nsh"

; ---------------------------------------------------------------------------------------------
; Cierre de la agenda antes de instalar, actualizar o desinstalar.
;
; Electron abre varios procesos ("Agenda Universitaria.exe" principal, GPU, renderizado…) y la
; app puede estar escondida en la bandeja. Antes se pedía cerrarlos una sola vez y se esperaba
; 1 s: si tardaban más, el desinstalador de la versión anterior aún los veía y mostraba
; «No se puede cerrar Agenda Universitaria» (y «Reintentar» funcionaba porque ya habían cerrado).
; Ahora se cierran todos (/F /T, solo los del usuario actual) y se ESPERA hasta que no quede
; ninguno (máx. ~12 s), sin preguntar nada.
; ---------------------------------------------------------------------------------------------
!macro agendaCloseRunningApp
  Push $0
  Push $1
  StrCpy $1 0
  ${Do}
    ; Sin filtro de usuario: con él, taskkill tarda ~45 s en resolver cuentas (o se cuelga si el
    ; nombre no se expande). Sin permisos de administrador tampoco puede cerrar procesos de otros
    ; usuarios, así que solo afecta a la agenda de quien instala.
    nsExec::Exec `"$SYSDIR\taskkill.exe" /F /T /IM "${APP_EXECUTABLE_FILENAME}"`
    Pop $0
    Sleep 400
    ; findstr devuelve 0 si todavía hay algún proceso con ese nombre
    nsExec::Exec `"$SYSDIR\cmd.exe" /C tasklist /FI "USERNAME eq %USERNAME%" /FI "IMAGENAME eq ${APP_EXECUTABLE_FILENAME}" /FO CSV /NH | "$SYSDIR\findstr.exe" /B /I /C:"\"${APP_EXECUTABLE_FILENAME}\""`
    Pop $0
    ${If} $0 != 0
      ${ExitDo}
    ${EndIf}
    IntOp $1 $1 + 1
    ${If} $1 >= 30
      ${ExitDo}
    ${EndIf}
  ${Loop}
  ; Un momento más para que Windows libere los archivos de la carpeta de instalación
  Sleep 500
  Pop $1
  Pop $0
!macroend

!macro customInit
  !insertmacro agendaCloseRunningApp
!macroend

; Reemplaza la comprobación estándar (que avisaba «No se puede cerrar…») por el cierre con espera
!macro customCheckAppRunning
  !insertmacro agendaCloseRunningApp
!macroend

!macro customUnInit
  !insertmacro agendaCloseRunningApp
!macroend

; En "Aplicaciones instaladas" de Windows: nombre sin número y la versión real (1.7.10.59), que
; electron-builder no sabe escribir con cuatro números. Se lee de la versión del propio .exe.
!macro customInstall
  ${GetFileVersion} "$INSTDIR\${APP_EXECUTABLE_FILENAME}" $0
  ${If} $0 != ""
    WriteRegStr SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}" "DisplayVersion" "$0"
  ${EndIf}
!macroend
