import { defineConfig } from "vitepress";
import { withMermaid } from "vitepress-plugin-mermaid";

export default withMermaid(
  defineConfig({
    title: "Agent Skills MCP",
    description:
      "Expose Agent Skills to any MCP-compatible AI agent through declarative, version-controlled configuration.",
    base: "/agentskills-mcp/",

    themeConfig: {
      logo: "/logo.svg",

      nav: [
        { text: "Guide", link: "/guide/" },
        { text: "Reference", link: "/reference/skill-format" },
        { text: "Architecture", link: "/architecture/overview" },
        {
          text: "GitHub",
          link: "https://github.com/mrsimpson/agentskills-mcp"
        }
      ],

      sidebar: {
        "/guide/": [
          {
            text: "Guide",
            items: [
              { text: "Why Agent Skills MCP?", link: "/guide/" },
              { text: "Getting Started", link: "/guide/getting-started" },
              { text: "Configuring Skills", link: "/guide/configuration" },
              { text: "CLI Reference", link: "/guide/cli" },
              { text: "Connecting Agents", link: "/guide/mcp-clients" }
            ]
          }
        ],
        "/reference/": [
          {
            text: "Reference",
            items: [
              { text: "SKILL.md Format", link: "/reference/skill-format" },
              {
                text: "Source Specifiers",
                link: "/reference/source-specifiers"
              },
              {
                text: "MCP Server Dependencies",
                link: "/reference/mcp-dependencies"
              }
            ]
          }
        ],
        "/architecture/": [
          {
            text: "Architecture",
            items: [
              { text: "System Overview", link: "/architecture/overview" },
              { text: "Package Structure", link: "/architecture/packages" },
              { text: "Design Decisions", link: "/architecture/decisions" }
            ]
          }
        ]
      },

      socialLinks: [
        { icon: "github", link: "https://github.com/mrsimpson/agentskills-mcp" }
      ],

      footer: {
        message: "Released under the MIT License.",
        copyright: "Copyright © Oliver Jägle"
      },

      search: {
        provider: "local"
      }
    },

    mermaid: {
      theme: "neutral"
    }
  })
);
