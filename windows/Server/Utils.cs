using System;
using System.Collections.Generic;
using System.IO;
using System.Reflection;

namespace Musiche.Server
{
    public class Utils
    {
        public static Dictionary<string, MethodInfo> ReadRouter(object obj)
        {
            Type type = obj.GetType();
            MethodInfo[] methods = type.GetMethods();
            Dictionary<string, MethodInfo> routers = new Dictionary<string, MethodInfo>();
            foreach (MethodInfo method in methods)
            {
                RouterAttribute[] attributes = (RouterAttribute[])method.GetCustomAttributes(typeof(RouterAttribute), false);

                foreach (RouterAttribute attribute in attributes)
                {
                    routers.Add(attribute.Router, method);
                }
            }
            return routers;
        }

        public static byte[] StreamToBytes(Stream stream)
        {
            using (var ms = new MemoryStream())
            {
                stream.CopyTo(ms);
                return ms.ToArray();
            }
        }
    }
}
