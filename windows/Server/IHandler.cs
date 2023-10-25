using System.Net;
using System.Threading.Tasks;

namespace Musiche.Server
{
    public interface IHandler
    {
        Task Handle(HttpListenerContext context);
    }
}
