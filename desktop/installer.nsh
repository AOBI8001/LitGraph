!macro customUnInstall
  ReadRegStr $0 HKCU "Software\Google\Chrome\NativeMessagingHosts\org.litgraph.browser" ""
  StrCmp $0 "$APPDATA\litgraph\browser-bridge\org.litgraph.browser.json" 0 +2
    DeleteRegKey HKCU "Software\Google\Chrome\NativeMessagingHosts\org.litgraph.browser"
  ReadRegStr $0 HKCU "Software\Microsoft\Edge\NativeMessagingHosts\org.litgraph.browser" ""
  StrCmp $0 "$APPDATA\litgraph\browser-bridge\org.litgraph.browser.json" 0 +2
    DeleteRegKey HKCU "Software\Microsoft\Edge\NativeMessagingHosts\org.litgraph.browser"
!macroend

; Remove the retired connector registrations when upgrading an existing install.
!macro customInstall
  ReadRegStr $0 HKCU "Software\Google\Chrome\NativeMessagingHosts\org.litgraph.browser" ""
  StrCmp $0 "$APPDATA\litgraph\browser-bridge\org.litgraph.browser.json" 0 +2
    DeleteRegKey HKCU "Software\Google\Chrome\NativeMessagingHosts\org.litgraph.browser"
  ReadRegStr $0 HKCU "Software\Microsoft\Edge\NativeMessagingHosts\org.litgraph.browser" ""
  StrCmp $0 "$APPDATA\litgraph\browser-bridge\org.litgraph.browser.json" 0 +2
    DeleteRegKey HKCU "Software\Microsoft\Edge\NativeMessagingHosts\org.litgraph.browser"
!macroend
