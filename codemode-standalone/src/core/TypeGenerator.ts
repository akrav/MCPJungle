import { compile as compileJsonSchemaToTs } from "json-schema-to-typescript";
import {
  zodToTs,
  printNode as printNodeZodToTs,
  createTypeAlias,
} from "zod-to-ts";
import type { z } from "zod";
import type { Tool, ToolSet, JSONSchema } from "../types/index.js";

/**
 * Generates TypeScript type definitions from tool schemas
 * These types are provided to the LLM to help it generate correctly-typed code
 */
export class TypeGenerator {
  /**
   * Converts a tool name to PascalCase for TypeScript type naming
   */
  private toCamelCase(str: string): string {
    return str
      .replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
      .replace(/^[a-z]/, (letter) => letter.toUpperCase());
  }

  /**
   * Checks if a schema is a Zod schema or JSON Schema
   */
  private isZodSchema(schema: any): schema is z.ZodType {
    return schema && typeof schema._def !== "undefined";
  }

  /**
   * Converts a single tool's input schema to TypeScript
   */
  private async generateInputType(
    tool: Tool,
    typeName: string
  ): Promise<string> {
    if (this.isZodSchema(tool.inputSchema)) {
      // Handle Zod schema
      const node = zodToTs(tool.inputSchema as z.ZodType, typeName).node;
      return printNodeZodToTs(createTypeAlias(node, typeName));
    } else {
      // Handle JSON Schema
      return await compileJsonSchemaToTs(
        tool.inputSchema as any,
        typeName,
        {
          format: false,
          bannerComment: "",
        }
      );
    }
  }

  /**
   * Converts a single tool's output schema to TypeScript
   */
  private async generateOutputType(
    tool: Tool,
    typeName: string
  ): Promise<string> {
    if (!tool.outputSchema) {
      return `interface ${typeName} { [key: string]: any }`;
    }

    if (this.isZodSchema(tool.outputSchema)) {
      // Handle Zod schema
      const node = zodToTs(tool.outputSchema as z.ZodType, typeName).node;
      return printNodeZodToTs(createTypeAlias(node, typeName));
    } else {
      // Handle JSON Schema
      return await compileJsonSchemaToTs(
        tool.outputSchema as any,
        typeName,
        {
          format: false,
          bannerComment: "",
        }
      );
    }
  }

  /**
   * Generates complete TypeScript definitions for all tools
   * Returns a string that can be provided to the LLM as context
   */
  async generateTypeDefinitions(tools: ToolSet): Promise<string> {
    let availableTypes = "";
    let availableFunctions = "";

    for (const [toolName, tool] of Object.entries(tools)) {
      const inputTypeName = `${this.toCamelCase(toolName)}Input`;
      const outputTypeName = `${this.toCamelCase(toolName)}Output`;

      // Generate input type
      const inputType = await this.generateInputType(tool, inputTypeName);
      availableTypes += `\n${inputType.trim().replace("export interface", "interface")}`;

      // Generate output type
      const outputType = await this.generateOutputType(tool, outputTypeName);
      availableTypes += `\n${outputType.trim().replace("export interface", "interface")}`;

      // Add function signature with JSDoc comment
      availableFunctions += `\n\t/**\n\t * ${tool.description?.trim()}\n\t */`;
      availableFunctions += `\n\t${toolName}: (input: ${inputTypeName}) => Promise<${outputTypeName}>;`;
      availableFunctions += "\n";
    }

    // Create the complete type definition
    const typeDefinitions = `
${availableTypes}

declare const tools: {${availableFunctions}};
`.trim();

    return typeDefinitions;
  }

  /**
   * Generates a plain text description of available tools
   * Useful for the initial LLM prompt
   */
  generateToolDescriptions(tools: ToolSet): string {
    return Object.entries(tools)
      .map(([toolName, tool]) => {
        return `- ${toolName}: ${tool.description?.trim()}`;
      })
      .join("\n");
  }
}

