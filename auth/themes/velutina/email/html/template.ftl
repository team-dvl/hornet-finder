<#-- Velutina layout shared by every HTML email: table-based with inline styles for mail client support -->
<#macro emailLayout>
<!DOCTYPE html>
<html lang="${locale.language}" dir="${(ltr)?then('ltr','rtl')}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
    .vl-content a { color: #1f6fb2; font-weight: bold; }
    .vl-content p { margin: 0 0 16px 0; }
</style>
</head>
<body style="margin:0; padding:0; background-color:#e6eddf;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#e6eddf;">
    <tr>
        <td align="center" style="padding:32px 16px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                   style="max-width:520px; background-color:#ffffff; border-radius:8px; box-shadow:0 4px 20px rgba(0,0,0,0.12);">
                <tr>
                    <td align="center" style="padding:28px 24px 8px 24px;">
                        <img src="${url.resourcesUrl}/img/vsab-logo.png" width="200" height="80"
                             alt="Vedrin s'Abeille" style="display:block; border:0; width:200px; height:80px;">
                    </td>
                </tr>
                <tr>
                    <td style="padding:8px 24px 0 24px;">
                        <#-- Colour strip echoing the blocks of the logo -->
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                                <td height="4" style="background-color:#f7c21a; font-size:0; line-height:0;">&nbsp;</td>
                                <td height="4" style="background-color:#f39200; font-size:0; line-height:0;">&nbsp;</td>
                                <td height="4" style="background-color:#e8483f; font-size:0; line-height:0;">&nbsp;</td>
                                <td height="4" style="background-color:#1aa89a; font-size:0; line-height:0;">&nbsp;</td>
                                <td height="4" style="background-color:#2a8fd6; font-size:0; line-height:0;">&nbsp;</td>
                            </tr>
                        </table>
                    </td>
                </tr>
                <tr>
                    <td class="vl-content"
                        style="padding:24px 32px 16px 32px; font-family:Helvetica, Arial, sans-serif; font-size:15px; line-height:1.55; color:#2b2f2a;">
                        <#nested>
                    </td>
                </tr>
                <tr>
                    <td align="center"
                        style="padding:16px 32px 24px 32px; border-top:1px solid #eceee9; font-family:Helvetica, Arial, sans-serif; font-size:12px; line-height:1.5; color:#7a8177;">
                        ${realmName!""} &middot; Vedrin s'Abeille
                    </td>
                </tr>
            </table>
        </td>
    </tr>
</table>
</body>
</html>
</#macro>
