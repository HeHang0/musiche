using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Runtime.InteropServices;
using System.Windows.Forms;

namespace Musiche.NotifyIcon
{
    public class ModernToolStripRenderer : ToolStripProfessionalRenderer
    {
        private readonly Font iconFont;
        private readonly System.Drawing.Text.PrivateFontCollection pfc;
        public ModernToolStripRenderer()
        {
            pfc = new System.Drawing.Text.PrivateFontCollection();
            pfc.AddFontFile(Utils.File.IconFontPath);
            iconFont = new Font(pfc.Families[0], 9, FontStyle.Bold);
        }
        protected override void OnRenderItemCheck(ToolStripItemImageRenderEventArgs e)
        {
            var rect = e.ImageRectangle;
            using (Pen pen = new Pen(Color.FromArgb(255, 64, 64), 2))
            {
                int x = e.Item.Width - 25;
                int y = rect.Top + (rect.Height - 10) / 2;
                Point[] points = new Point[]
                {
                        new Point(x - 3, y + 5),
                        new Point(x + 1, y + 9),
                        new Point(x + 10, y),
                };
                e.Graphics.DrawLines(pen, points);
            }
        }

        protected override void OnRenderArrow(ToolStripArrowRenderEventArgs e)
        {
            if (e.Item is ToolStripDropDownButton && e.Item.RightToLeftAutoMirrorImage == true)
            {
                var x = e.ArrowRectangle.Right - 5;
                var y = e.ArrowRectangle.Top + (e.ArrowRectangle.Bottom / 2) - 10;
                using (Pen pen = new Pen(e.Item.ForeColor, 2))
                {
                    Point[] points = new Point[]
                    {
                        new Point(x - 5, y - 5),
                        new Point(x,y),
                        new Point(x - 5, y + 5),
                    };
                    e.Graphics.DrawLines(pen, points);
                }
            }
            else if (e.Item is ToolStripMenuItem && e.Item.IsOnDropDown)
            {
                var x = e.ArrowRectangle.Right - 5;
                var y = e.ArrowRectangle.Top + (e.ArrowRectangle.Bottom / 2) - 5;
                using (Pen pen = new Pen(e.Item.ForeColor, 2))
                {
                    Point[] points = new Point[]
                    {
                        new Point(x - 10, y - 5),
                        new Point(x - 5,y),
                        new Point(x - 10, y + 5),
                    };
                    e.Graphics.DrawLines(pen, points);
                }
            }
            else
            {
                base.OnRenderArrow(e);
            }
        }

        protected override void OnRenderMenuItemBackground(ToolStripItemRenderEventArgs e)
        {
            if (!e.Item.Selected) return;
            var bgColor = ThemeListener.IsDarkMode ? Color.FromArgb(0x1A, 0xFF, 0xFF, 0xFF) : Color.FromArgb(0x1A, 0, 0, 0);

            var rect = new Rectangle(4, 0, e.Item.Width - 8, e.Item.Height - 1);

            using (var brush = new SolidBrush(bgColor))
            {
                e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                GraphicsPath path = GetRoundedRect(rect, 3);
                e.Graphics.FillPath(brush, path);
            }
        }

        private GraphicsPath GetRoundedRect(Rectangle rect, int cornerRadius)
        {
            int diameter = 2 * cornerRadius;
            Size size = new Size(diameter, diameter);
            Rectangle arcRect = new Rectangle(rect.Location, size);
            GraphicsPath path = new GraphicsPath();

            path.AddArc(arcRect, 180, 90);

            arcRect.X = rect.Right - diameter;
            path.AddArc(arcRect, 270, 90);

            arcRect.Y = rect.Bottom - diameter;
            path.AddArc(arcRect, 0, 90);

            arcRect.X = rect.Left;
            path.AddArc(arcRect, 90, 90);

            path.CloseFigure();
            return path;
        }

        protected override void OnRenderToolStripBorder(ToolStripRenderEventArgs e)
        {
        }

        protected override void OnRenderToolStripBackground(ToolStripRenderEventArgs e)
        {
        }

        protected override void OnRenderImageMargin(ToolStripRenderEventArgs e)
        {
        }

        protected override void OnRenderItemImage(ToolStripItemImageRenderEventArgs e)
        {
            if (e.Item.Tag != null)
            {
                e.Graphics.DrawString(e.Item.Tag.ToString(), iconFont, new SolidBrush(e.Item.ForeColor), e.ImageRectangle.X + 5, e.ImageRectangle.Y+2);
            }
            else if (e.Image != null)
            {
                e.Graphics.DrawImage(e.Image, e.ImageRectangle);
            }
        }

        protected override void OnRenderItemText(ToolStripItemTextRenderEventArgs e)
        {
            e.TextFormat |= TextFormatFlags.VerticalCenter;
            e.TextRectangle = new Rectangle(e.TextRectangle.X, e.TextRectangle.Y + 10, e.TextRectangle.Width, e.TextRectangle.Height);
            base.OnRenderItemText(e);
        }

        protected override void OnRenderSeparator(ToolStripSeparatorRenderEventArgs e)
        {
            if (e.Vertical)
            {
                base.OnRenderSeparator(e);
            }
            else
            {
                var bgColor = ThemeListener.IsDarkMode ? Color.FromArgb(0x1A, 0xFF, 0xFF, 0xFF) : Color.FromArgb(0x1A, 0, 0, 0);
                using (Pen pen = new Pen(bgColor, 1))
                {
                    Point start = new Point(10, 3);
                    Point end = new Point(e.Item.Size.Width - 20, 3);
                    e.Graphics.DrawLine(pen, start, end);
                }
            }
        }
    }
}
