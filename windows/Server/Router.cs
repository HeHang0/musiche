using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.WebSockets;
using System.Reflection;
using System.Threading.Tasks;

namespace Musiche.Server
{
    public class Router
    {
        public static Dictionary<string, Func<HttpListenerContext, Task>> ReadHttpRouter(object obj)
        {
            Dictionary<string, Func<HttpListenerContext, Task>> routers = new Dictionary<string, Func<HttpListenerContext, Task>>();
            if(obj == null) return routers;
            Type type = obj.GetType();
            MethodInfo[] methods = type.GetMethods();
            foreach (MethodInfo method in methods)
            {
                if(!IsParameterRoute(method, typeof(HttpListenerContext))) continue;
                RouterAttribute[] attributes = (RouterAttribute[])method.GetCustomAttributes(typeof(RouterAttribute), false);
                var func = method.IsStatic ? 
                    (Func<HttpListenerContext, Task>)Delegate.CreateDelegate(typeof(Func<HttpListenerContext, Task>), method) : 
                    (Func<HttpListenerContext, Task>)Delegate.CreateDelegate(typeof(Func<HttpListenerContext, Task>), obj, method);
                foreach (RouterAttribute attribute in attributes)
                {
                    routers.Add(attribute.Router.ToUpper(), func);
                }
            }
            return routers;
        }
        public static Dictionary<string, Func<WebSocket, Task>> ReadWebSocketRouter(object obj)
        {
            Dictionary<string, Func<WebSocket, Task>> routers = new Dictionary<string, Func<WebSocket, Task>>();
            if (obj == null) return routers;
            Type type = obj.GetType();
            MethodInfo[] methods = type.GetMethods();
            foreach (MethodInfo method in methods)
            {
                if (!IsParameterRoute(method, typeof(WebSocket))) continue;
                RouterAttribute[] attributes = (RouterAttribute[])method.GetCustomAttributes(typeof(RouterAttribute), false);
                var func = method.IsStatic ?
                    (Func<WebSocket, Task>)Delegate.CreateDelegate(typeof(Func<WebSocket, Task>), method) :
                    (Func<WebSocket, Task>)Delegate.CreateDelegate(typeof(Func<WebSocket, Task>), obj, method);
                foreach (RouterAttribute attribute in attributes)
                {
                    routers.Add(attribute.Router.ToUpper(), func);
                }
            }
            return routers;
        }

        private static Func<HttpListenerContext, Task> ToHttpRouteMethod(MethodInfo method)
        {
            if (method.IsStatic)
            {
                return (Func<HttpListenerContext, Task>)Delegate.CreateDelegate(typeof(Func<HttpListenerContext, Task>), method);
            }
            else
            {
                object instance = Activator.CreateInstance(method.DeclaringType);
                return (Func<HttpListenerContext, Task>)Delegate.CreateDelegate(typeof(Func<HttpListenerContext, Task>), instance, method);
            }
        }

        private static Func<WebSocket, Task> ToWebSocketRouteMethod(MethodInfo method)
        {
            if (method.IsStatic)
            {
                return (Func<WebSocket, Task>)Delegate.CreateDelegate(typeof(Func<WebSocket, Task>), method);
            }
            else
            {
                object instance = Activator.CreateInstance(method.DeclaringType);
                return (Func<WebSocket, Task>)Delegate.CreateDelegate(typeof(Func<WebSocket, Task>), instance, method);
            }
        }

        private static bool IsParameterRoute(MethodInfo method, Type parameterType)
        {
            return method.GetCustomAttributes().OfType<RouterAttribute>().Any()
                && method.DeclaringType != null
                && method.ReturnType == typeof(Task)
                && method.GetParameters().Length == 1
                && method.GetParameters().First().ParameterType == parameterType;
        }
    }
}
