using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Musiche.Utils
{
    public class WindowStatus
    {
        public double Width { get; set; }
        public double Height { get; set; }
        public double X { get; set; }
        public double Y { get; set; }
        public bool Locked { get; set; }

        public static WindowStatus Parse(string text)
        {
            try
            {
                return JsonConvert.DeserializeObject<WindowStatus>(text);
            }
            catch (Exception)
            {
                return new WindowStatus();
            }
        }

        public override string ToString()
        {
            try
            {

                return JsonConvert.SerializeObject(this);
            }
            catch (Exception)
            {
                return string.Empty;
            }
        }
    }
}
