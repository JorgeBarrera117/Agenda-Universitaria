!ifndef nsProcess::KillProcess
  !include "nsProcess.nsh"
!endif

!macro customInit
  ; Mata cualquier proceso activo de Agenda Universitaria mediante el plugin nativo de C++
  ${nsProcess::KillProcess} "Agenda Universitaria.exe" $0
  ${nsProcess::Unload}
!macroend

!macro customCheckAppRunning
  ; Reemplaza la comprobacion estandar por el cierre forzado nativo C++
  ${nsProcess::KillProcess} "Agenda Universitaria.exe" $0
  ${nsProcess::Unload}
  Sleep 1000
!macroend

!macro customUnInit
  ; Mata cualquier proceso activo residual antes de desinstalar
  ${nsProcess::KillProcess} "Agenda Universitaria.exe" $0
  ${nsProcess::Unload}
!macroend
