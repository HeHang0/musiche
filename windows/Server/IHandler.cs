using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Text;
using System.Threading.Tasks;

namespace Musiche.Server
{
    public interface IHandler
    {
        Task Handle(HttpListenerContext context);
    }
}
