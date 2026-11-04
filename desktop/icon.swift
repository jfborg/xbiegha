import AppKit

// Render the existing Xbieha mark at native icon resolution, with macOS padding.
let size = 1024
let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
let graphics = NSGraphicsContext(bitmapImageRep: bitmap)!
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = graphics
let context = graphics.cgContext
context.setShadow(offset: CGSize(width: 0, height: -10), blur: 20, color: NSColor.black.withAlphaComponent(0.16).cgColor)
context.setFillColor(NSColor(srgbRed: 187/255, green: 132/255, blue: 96/255, alpha: 1).cgColor)
context.addPath(CGPath(roundedRect: CGRect(x: 64, y: 64, width: 896, height: 896), cornerWidth: 244, cornerHeight: 244, transform: nil))
context.fillPath()
context.setShadow(offset: .zero, blur: 0)
context.translateBy(x: 64, y: 64)
context.scaleBy(x: 11.2, y: 11.2)
context.setStrokeColor(NSColor(srgbRed: 11/255, green: 24/255, blue: 38/255, alpha: 1).cgColor)
context.setLineWidth(5.5)
context.setLineCap(.round)
context.setLineJoin(.round)
for points: [CGPoint] in [
  [.init(x: 21,y: 24), .init(x: 34,y: 24), .init(x: 46,y: 40), .init(x: 34,y: 56), .init(x: 21,y: 56), .init(x: 33,y: 40)],
  [.init(x: 59,y: 24), .init(x: 46,y: 24), .init(x: 34,y: 40), .init(x: 46,y: 56), .init(x: 59,y: 56), .init(x: 47,y: 40)]
] {
  context.beginPath(); context.move(to: points[0])
  for point in points.dropFirst() { context.addLine(to: point) }
  context.closePath(); context.strokePath()
}
NSGraphicsContext.restoreGraphicsState()
try bitmap.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: CommandLine.arguments[1]))
