!macro customInit
  ; Mata cualquier proceso activo residual antes de inicializar el instalador
  nsExec::Exec 'taskkill /F /T /IM "Agenda Universitaria.exe"'
!macroend

!macro customCheckAppRunning
  ; Reemplaza la verificacion por defecto de electron-builder (que lanza la ventana de error si el proceso tarda en cerrar).
  ; Mata el arbol completo de procesos de Electron (ventana, GPU, renderers, crashpad) y espera a que Windows libere los bloqueos de disco.
  nsExec::Exec 'taskkill /F /T /IM "Agenda Universitaria.exe"'
  Sleep 1200
!macroend

!macro customUnInit
  ; Mata cualquier proceso activo residual antes de desinstalar
  nsExec::Exec 'taskkill /F /T /IM "Agenda Universitaria.exe"'
!macroend
