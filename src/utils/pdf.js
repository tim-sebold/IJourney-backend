export const ensureSpace = (doc, neededHeight, bottomMargin = 60) => {
    const pageBottom = doc.page.height - bottomMargin;
    if (doc.y + neededHeight > pageBottom) {
        doc.addPage();
    }
}

export const drawSectionHeader = (doc, text) => {
    const h = doc.heightOfString(text, { width: doc.page.width - doc.page.margins.left - doc.page.margins.right });
    ensureSpace(doc, h + 18);

    doc.moveDown(1);
    doc.fontSize(14).text(text, { underline: true });
    doc.moveDown(0.5);
}

export const drawKeyValue = (doc, key, value) => {
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    const keyText = `${key}:`;
    const valueText = value?.trim() ? value : "-";

    const keyH = doc.heightOfString(keyText, { width });
    const valueH = doc.heightOfString(valueText, { width, indent: 14 });

    ensureSpace(doc, keyH + valueH + 10);

    doc.fontSize(11).text(keyText, { width });
    doc.fontSize(10).text(valueText, { width, indent: 14 });
    doc.moveDown(0.4);
}