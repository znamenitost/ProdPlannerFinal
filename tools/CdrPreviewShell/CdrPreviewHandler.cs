using System;
using System.Runtime.InteropServices;
using SharpShell.Attributes;
using SharpShell.SharpPreviewHandler;

namespace CdrPreviewShell;

[ComVisible(true)]
[DisplayName("CDR File Preview")]
[Guid("8f3e2a1b-4c5d-6e7f-8a9b-0c1d2e3f4a5b")]
[PreviewHandler]
[COMServerAssociation(AssociationType.ClassOfExtension, ".cdr")]
public sealed class CdrPreviewHandler : SharpPreviewHandler
{
    protected override PreviewHandlerControl DoPreview()
    {
        var control = new CdrPreviewControl();
        control.DoPreview(SelectedFilePath);
        return control;
    }
}
