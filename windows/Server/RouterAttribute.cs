using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Musiche.Server
{
    [AttributeUsage(AttributeTargets.Method, Inherited = false, AllowMultiple = true)]
    public sealed class RouterAttribute : Attribute
    {
        public string Router { get; }

        public RouterAttribute(string router)
        {
            Router = router;
        }
    }
}
