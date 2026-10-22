!macro customInit
  ; Mata cualquier proceso activo residual antes de instalar o actualizar
  nsExec::Exec 'taskkill /f /im "Agenda Universitaria.exe"'
!macroend

!macro customUnInit
  ; Mata cualquier proceso activo residual antes de desinstalar
  nsExec::Exec 'taskkill /f /im "Agenda Universitaria.exe"'
!macroend
